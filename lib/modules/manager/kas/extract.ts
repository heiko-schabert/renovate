import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { logger } from '../../../logger';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
//import { parseGitUrl } from '../../../util/git/url';
//import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { KasProject, KasRepo } from './schema';

//import { getSiblingFileName } from '../../../util/fs';
import { id as looseVersioning } from '../../versioning/loose';

import { parseSingleYamlDocument } from '../../../util/yaml';
import { Document, YAMLMap } from 'yaml';

function dependencyStrategy(
  repo: KasRepo,
  repoString: string | undefined,
): PackageDependency {
  logger.debug({ repo }, 'kas.dependencyStrategy');

  const git = repo.url;
  const rev = repo.commit ?? undefined;
  const branch = repo.branch ?? undefined;
  const tag = repo.tag ?? undefined;

  let packageDependency: PackageDependency = {
    currentDigest: rev,
    packageName: git,
    versioning: repo.branch ? looseVersioning : undefined,
    newValue: undefined,
    replaceString: repoString,
  };

  if (tag) {
    packageDependency.datasource = GitTagsDatasource.id;
    packageDependency.currentValue = tag;
  } else {
    packageDependency.datasource = GitRefsDatasource.id;
    packageDependency.currentValue = branch;
    //currentRawValue : repo.branch ? branch : undefined,
    //gitRef: repo.branch ? branch : rev,
    //digestOneAndOnly: repo.branch ? true : undefined,
    //pinDigests: repo.branch ? true: undefined,

    //autoReplaceStringTemplate: '{{{depName}}} {{{newValue}}}',
    //autoReplaceStringTemplate:
    //  '{{depName}}\ncommit: {{#if newDigest}}{{newDigest}}',
  }

  return packageDependency;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  logger.info('Running KAS manager');
  logger.debug({ packageFile }, 'kas.extractPackageFile');

  let kasProjectFile: KasProject;
  let rawYamlDocument: Document;
  try {
    logger.debug({ content }, 'kas.extractPackageFile: file content');
    rawYamlDocument = parseSingleYamlDocument(content, {
      removeTemplates: true,
    });
    kasProjectFile = KasProject.parse(rawYamlDocument.toJS());
    logger.debug(
      { kasProjectFile },
      'kas.extractPackageFile: parsed KAS project file',
    );
  } catch (err) {
    logger.debug(
      { err, packageFile },
      `kas.extractPackageFile: Parsing KAS project config YAML failed`,
    );
    return null;
  }

  const deps: PackageDependency[] = [];
  try {
    const fileFormatVersion = kasProjectFile.header.version;
    logger.debug(
      { fileFormatVersion },
      'kas.extractPackageFile: file format version',
    );
    const reposNode = rawYamlDocument.get('repos', true);
    if (reposNode instanceof YAMLMap) {
      for (const repoItem of reposNode.items) {
        const repoName = repoItem.key.toString();
        const repoNode = repoItem.value;
        const repo = KasRepo.parse(repoNode.toJS(rawYamlDocument));
        logger.debug({ repoName, repo }, 'kas.extractPackageFile');
        let repoString: string | undefined = undefined;
        if (repoNode && repoNode.range) {
          const [start, end] = repoNode.range;
          repoString = content.substring(start, end);
        }
        // Anticorruption layer to deal with different KAS file version formats
        /*
        switch (fileFormatVersion) {
          case 21:
            logger.debug(
              { fileFormatVersion },
              'kas.extractPackageFile: Unsupported KAS file version',
            );
            return null;
          default:
            logger.debug(
              { fileFormatVersion },
              'kas.extractPackageFile: Unknown KAS file version',
            );
        }
        */
        // Check if conditions are fullfilled
        if (!repo?.url) {
          logger.info({ repo }, 'kas.extractPackageFile: No repo URL found');
          continue;
        }
        if (!repo?.commit && !repo?.tag) {
          logger.info(
            { repo },
            'kas.extractPackageFile: No commit and tag found. Not sure what to keep track of.',
          );
          continue;
        }

        if (repo?.tag && repo?.branch) {
          logger.warn(
            { repo },
            'kas.extractPackageFile: Cannot have both tag and branch defined. Skipping.',
          );
          continue;
        }

        const dep = dependencyStrategy(repo, repoString);
        logger.debug({ dep }, 'kas.extractPackageFile: extracted dependency');
        deps.push(dep);
      }
    }
  } catch (err) {
    if (err.stack?.startsWith('YAMLException:')) {
      logger.debug(
        { err, packageFile },
        'kas.extractPackageFile: YAML exception extracting KAS dependencies',
      );
    } else {
      logger.debug(
        { err, packageFile },
        'kas.extractPackageFile: Error extracting KAS dependencies',
      );
    }
  }

  // TODO: Add logic to detect lock files
  //const lockFile = getSiblingFileName(packageFile, 'kas-lock.yml');
  //return { deps, lockFiles: [lockFile] };
  return deps.length ? { deps } : null;
}
