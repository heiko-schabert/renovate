import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';
import {
  KasDump,
  KasProject,
  KasProjectYaml,
  KasProjectJson,
  KasLockFileYaml,
  KasLockFileJson,
  KasRepo,
} from './schema';
import { logger } from '../../../logger';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { id as looseVersioning } from '../../versioning/loose';
import { parseSingleYamlDocument } from '../../../util/yaml';
import { readLocalFile } from '../../../util/fs';
import { ExecOptions } from '../../../util/exec/types';
import { exec } from '../../../util/exec';
import { Document, YAMLMap } from 'yaml';
import path from 'path';
import { findNodeAtLocation, getNodeValue, parseTree } from 'jsonc-parser';

export function getLockFilePath(filePath: string): string | null {
  if (isLockFilePath(filePath)) {
    logger.trace(
      { filePath },
      'file path is already a lock file path. Returning null',
    );
    return null;
  }
  const lockFilePath = filePath.replace(/\.(yml|yaml|json)$/i, '.lock.$1');
  if (lockFilePath === filePath) {
    logger.debug(
      { filePath },
      'unsupported kas file type (.yml, .yaml, .json)',
    );
    return null;
  }
  return lockFilePath;
}

export function isLockFilePath(filePath: string): boolean {
  return /\.lock\.(yml|yaml|json)$/i.test(filePath);
}

export function isYamlFilePath(filePath: string): boolean {
  return /\.(yml|yaml)$/i.test(filePath);
}

export function getProjectParser(
  filePath: string,
): typeof KasProjectYaml | typeof KasProjectJson {
  const isYaml = isYamlFilePath(filePath);
  return isYaml ? KasProjectYaml : KasProjectJson;
}

export function getLockParser(
  filePath: string,
): typeof KasLockFileYaml | typeof KasLockFileJson {
  const isYaml = isYamlFilePath(filePath);
  return isYaml ? KasLockFileYaml : KasLockFileJson;
}

function extractRepoStrings(
  content: string,
  packageFile: string,
): Map<string, string> {
  let map = new Map<string, string>();
  if (isYamlFilePath(packageFile)) {
    let rawYamlDocument: Document;
    try {
      rawYamlDocument = parseSingleYamlDocument(content);
    } catch (err) {
      logger.debug({ packageFile, err }, `Parsing KAS YAML file failed`);
      return map;
    }
    let reposNode = rawYamlDocument.get('repos');
    if (!(reposNode instanceof YAMLMap)) {
      const overridesNode = rawYamlDocument.get('overrides');
      if (overridesNode instanceof YAMLMap) {
        reposNode = overridesNode.get('repos');
      }
    }
    if (!(reposNode instanceof YAMLMap)) {
      logger.debug({ packageFile }, 'no repos found in KAS file');
      return map;
    }
    for (const repoItem of reposNode.items) {
      const repoName = repoItem.key.toString();
      const repoNode = repoItem.value;
      if (repoItem.key.range && repoNode && repoNode.range) {
        const [keyStart] = repoItem.key.range;
        const [, valueEnd] = repoNode.range;
        map.set(repoName, content.substring(keyStart, valueEnd));
      }
    }
  } else {
    try {
      const jsonRoot = parseTree(content);
      if (!jsonRoot) {
        logger.debug({ packageFile }, 'no content parsed from JSON file');
        return map;
      }
      let reposNode = findNodeAtLocation(jsonRoot, ['repos']);
      if (!reposNode || reposNode.type !== 'object') {
        reposNode = findNodeAtLocation(jsonRoot, ['overrides', 'repos']);
      }
      if (!reposNode || reposNode.type !== 'object') {
        logger.debug({ packageFile }, 'no repos found in JSON file');
        return map;
      }
      for (const property of reposNode.children || []) {
        if (property.type === 'property' && property.children?.length === 2) {
          const repoNameNode = property.children[0];
          const repoName = getNodeValue(repoNameNode);
          const start = property.offset;
          const end = property.offset + property.length;
          map.set(repoName, content.substring(start, end));
        }
      }
    } catch (err) {
      logger.debug({ packageFile, err }, `Parsing KAS JSON file failed`);
      return map;
    }
  }
  return map;
}

async function extractPackageFile(
  content: string,
  packageFile: string,
  kasDump: KasDump,
  _config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  logger.trace(`kas.extractPackageFile ${packageFile}`);
  logger.trace({ content });
  const isLockFile = isLockFilePath(packageFile);
  let repos: Record<string, KasRepo | null | undefined> | undefined;
  try {
    if (isLockFile) {
      const lockFile = getLockParser(packageFile).parse(content);
      repos = lockFile.overrides?.repos;
    } else {
      const projectFile = getProjectParser(packageFile).parse(content);
      repos = projectFile.repos;
    }
  } catch (err) {
    logger.warn({ packageFile, err }, `Parsing KAS file failed`);
    return null;
  }
  if (!repos) {
    logger.debug({ packageFile }, 'no repos found in KAS file');
    return null;
  }
  let repoStrings: Map<string, string> = extractRepoStrings(
    content,
    packageFile,
  );
  logger.trace({ repoStrings }, 'extracted repo strings from file content');
  const deps: PackageDependency[] = [];
  for (const repoName in repos) {
    const repo = repos[repoName];
    if (!repo) {
      logger.trace(
        { packageFile, repoName },
        'repo entry is null or undefined, skipping',
      );
      continue;
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

    let replaceString = repoStrings.get(repoName);
    if (!replaceString) {
      logger.warn(
        { packageFile, repoName },
        'could not extract repo string from file, using entire file content',
      );
      replaceString = content;
    }
    logger.trace({ replaceString, repoName }, 'string to replace for repo');
    let packageDependency: PackageDependency = {
      depName: repo.name ?? repoName,
      packageName: git,
      versioning: repo.branch ? looseVersioning : undefined,
      replaceString: replaceString,
      currentDigest: commit,
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
    logger.debug(
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
      if (!file) {
        continue;
      }
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
          const parser = getProjectParser(file);
          const kasFile: KasProject = parser.parse(content);
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
