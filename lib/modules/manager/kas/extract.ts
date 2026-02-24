import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import { KasDump, KasLockFile, KasProject, KasRepo } from './schema';
import { logger } from '../../../logger';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { id as looseVersioning } from '../../versioning/loose';
import { parseSingleYaml, parseSingleYamlDocument } from '../../../util/yaml';
import { readLocalFile } from '../../../util/fs';
import { ExecOptions } from '../../../util/exec/types';
import { exec } from '../../../util/exec';
import { Document, YAMLMap } from 'yaml';
import path from 'path';

export function getLockFilePath(filePath: string): string {
  const lockFilePath = filePath.replace(/\.(yml|yaml)$/i, '.lock.$1');
  if (lockFilePath === filePath && !isLockFilePath(filePath)) {
    logger.debug({ filePath }, 'not a supported kas file type (.yml, .yaml)');
  }
  return lockFilePath;
}

export function isLockFilePath(filePath: string): boolean {
  return /\.lock\.(yml|yaml)$/i.test(filePath);
}

async function extractPackageFile(
  content: string,
  packageFile: string,
  kasDump: KasDump,
  _config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`kas.extractPackageFile(${packageFile})`);
  logger.trace({ content });
  const isLockFile = isLockFilePath(packageFile);

  let kasFile: KasProject | KasLockFile;
  let rawYamlDocument: Document;
  try {
    rawYamlDocument = parseSingleYamlDocument(content, {
      removeTemplates: true,
    });
    if (!isLockFile) kasFile = KasProject.parse(rawYamlDocument.toJS());
    else kasFile = KasLockFile.parse(rawYamlDocument.toJS());
    logger.trace({ kasFile }, 'parsed KAS file');
  } catch (err) {
    logger.debug({ packageFile, err }, `Parsing KAS file failed`);
    return null;
  }

  const deps: PackageDependency[] = [];
  let reposNode;
  if (isLockFile) {
    const overridesNode = rawYamlDocument.get('overrides');
    if (overridesNode instanceof YAMLMap) {
      reposNode = overridesNode.get('repos');
    } else {
      logger.debug(
        { packageFile },
        'no overrides section found in lock file, cannot extract dependencies',
      );
      return null;
    }
  } else {
    reposNode = rawYamlDocument.get('repos');
  }
  if (!(reposNode instanceof YAMLMap)) {
    logger.debug({ packageFile }, 'no repos found in KAS file');
    return null;
  }
  for (const repoItem of reposNode.items) {
    const repoName = repoItem.key.toString();
    const repoNode = repoItem.value;
    let repo: KasRepo;
    try {
      repo = KasRepo.parse(repoNode.toJS(rawYamlDocument));
    } catch (err) {
      logger.debug(
        { packageFile, repoName, err },
        'Error parsing repo entry, skipping',
      );
      continue;
    }
    logger.debug({ repoName, repo }, 'kas.extractPackageFile');
    let repoString: string | undefined = undefined;
    if (repoNode && repoNode.range) {
      const [start, end] = repoNode.range;
      repoString = content.substring(start, end);
    }
    const dumpRepo: KasRepo | null | undefined = kasDump.repos?.[repoName];
    if (!dumpRepo) {
      logger.debug({ packageFile }, 'no corresponding repo in dump. Skipping');
      continue;
    }
    const overridesCommit: string | undefined =
      kasDump.overrides?.repos?.[repoName]?.commit;
    if (overridesCommit) {
      dumpRepo.commit = overridesCommit;
    }
    logger.trace(
      { packageFile, dumpRepo, repo },
      'corresponding dump repo details',
    );

    if (dumpRepo.type && repo.type === 'hg') {
      logger.debug(
        { repo, dumpRepo },
        'Mercurial repos are not supported by Renovate. Skipping.',
      );
      continue;
    }
    if (repo.url && dumpRepo.url && repo.url !== dumpRepo.url) {
      logger.warn(
        { repo, dumpRepo },
        'Repo URL in file does not match dump. Skipping.',
      );
      continue;
    }
    const git = repo.url ?? dumpRepo.url;
    if (!isLockFile && !git) {
      logger.debug({ repo }, 'No repo URL found. Skipping');
      continue;
    }
    const isCommitInDump = repo.commit && dumpRepo.commit === repo.commit;
    const isTagInDump = repo.tag && repo.tag === dumpRepo.tag;
    if (!isCommitInDump && !isTagInDump) {
      logger.debug(
        { repo },
        'No relevant commit and tag found. Nothing to update.',
      );
      continue;
    }

    const commit = isCommitInDump ? dumpRepo.commit : undefined;
    const branch = dumpRepo.branch ?? undefined;
    const tag = dumpRepo.tag ?? undefined;

    if (branch && tag) {
      logger.warn(
        { repo },
        'Cannot have both tag and branch defined. Skipping.',
      );
      continue;
    }

    let packageDependency: PackageDependency = {
      currentDigest: commit,
      packageName: git,
      versioning: repo.branch ? looseVersioning : undefined,
      replaceString: repoString,
    };

    if (tag) {
      packageDependency.datasource = GitTagsDatasource.id;
      packageDependency.currentValue = tag;
    } else {
      packageDependency.datasource = GitRefsDatasource.id;
      packageDependency.currentValue = branch;
    }

    logger.debug({ packageDependency }, 'extracted dependency');
    deps.push(packageDependency);
  }
  return deps.length > 0 ? { deps } : null;
}

async function executeKasDump(file: string): Promise<KasDump | null> {
  let cmd = `kas dump --format json ${file}`;
  const execOptions: ExecOptions = {
    toolConstraints: [
      {
        toolName: 'kas',
      },
    ],
    docker: {},
    extraEnv: {
      KAS_CLONE_DEPTH: '1',
    },
  };

  let dump: string;
  try {
    logger.debug(`running kas dump on ${file}`);
    const result = await exec(cmd, execOptions);
    dump = result.stdout;
  } catch (err) {
    logger.error({ err }, 'Error executing kas dump');
    return null;
  }
  logger.trace({ dump }, 'result from kas dump command');

  try {
    return KasDump.parse(dump);
  } catch (err) {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug({ file, err }, 'YAML exception parsing kas dump');
    } else {
      logger.debug({ file, err }, 'Error parsing kas dump');
    }
    return null;
  }
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const results: PackageFile[] = [];
  const seen = new Set<string>(packageFiles);
  for (const rootFile of packageFiles) {
    logger.trace(
      { rootFile },
      'kas.extractAllPackageFiles: processing root file',
    );

    if (rootFile in seen) {
      logger.warn(
        { rootFile },
        'only specify the root entry kas file in matchFiles renovate config. Skipping.',
      );
      continue;
    }

    const filesToExamine = [rootFile, getLockFilePath(rootFile)];

    const kasDump = await executeKasDump(rootFile);
    if (!kasDump) {
      logger.debug({ rootFile }, 'kas dump returned no data, skipping file');
      continue;
    }
    logger.debug(`kas file format version ${kasDump.header.version}`);

    while (filesToExamine.length > 0) {
      const file = filesToExamine.pop()!;
      const isLockFile = isLockFilePath(file);
      logger.trace({ file }, 'kas.extractAllPackageFiles: processing file');
      seen.add(file);
      const content = await readLocalFile(file, 'utf8');
      if (!content) {
        if (!isLockFile) {
          logger.debug({ file }, `Empty or non existent KAS project file`);
        } else {
          logger.trace({ file }, `non existant lock file`);
        }
        continue;
      }

      try {
        if (!isLockFile) {
          const kasFile: KasProject = parseSingleYaml(content, {
            customSchema: KasProject,
            removeTemplates: true,
          });
          const includes = kasFile.header.includes;
          for (const include of includes || []) {
            let includedFilePath: string | null = null;
            if (typeof include === 'string') {
              includedFilePath = include;
              if (path.isAbsolute(includedFilePath)) {
                logger.debug(
                  { include },
                  'can not process absolute include paths',
                );
                continue;
              }
            } else if (typeof include === 'object' && include.file) {
              logger.debug(
                { include },
                'can not process include files from other repos',
              );
              continue;
            } else {
              logger.debug({ include }, 'Unknown include format');
              continue;
            }
            const normalizedPath = path.normalize(includedFilePath);
            if (packageFiles.includes(normalizedPath)) {
              logger.warn(
                { file: normalizedPath },
                'Only the root entry kas file should be specified in matchFiles renovate config. Skipping include entry.',
              );
              continue;
            }
            if (
              !filesToExamine.includes(normalizedPath) &&
              !seen.has(normalizedPath)
            ) {
              filesToExamine.push(normalizedPath);
              filesToExamine.push(getLockFilePath(normalizedPath));
              logger.trace({ file: normalizedPath }, 'Added file from include');
            }
          }
        }
      } catch (err) {
        logger.warn({ file, err }, `Parsing KAS file failed`);
        continue;
      }
      const packageFileContent: PackageFileContent | null =
        await extractPackageFile(content, file, kasDump, config);
      if (packageFileContent) {
        results.push({
          packageFile: file,
          ...packageFileContent,
        });
      }
    }

    logger.debug(
      { packageFiles, files: filesToExamine.entries() },
      'Extracted all KAS files',
    );
  }
  return results;
}
