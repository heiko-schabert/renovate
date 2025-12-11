import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { logger } from '../../../logger';
import { GitRefsDatasource } from '../../datasource/git-refs';
//import { parseGitUrl } from '../../../util/git/url';
//import { getSiblingFileName, readLocalFile } from '../../../util/fs';
import { KasProject, KasRepo } from './schema';

import { parseSingleYaml } from '../../../util/yaml';
//import { getSiblingFileName } from '../../../util/fs';
import { id as looseVersioning } from '../../versioning/loose';
//import { GitTagsDatasource } from '../../datasource/git-tags';

function dependencyStrategy(repo: KasRepo): PackageDependency {
  logger.debug({ repo }, 'kas.dependencyStrategy');

  const git = repo.url;
  const rev = repo.commit;
  const branch = repo?.branch ?? undefined;
  // TODO: Distinguish between ref (commit), branch or tag based dependencies
  //       Create function, which implements strategys to detect to distinquish.
  const packageDependency: PackageDependency = {
    datasource: repo.branch ? GitRefsDatasource.id : GitRefsDatasource.id,
    currentDigest: rev,
    packageName: git,
    //currentRawValue : repo.branch ? branch : undefined,
    currentValue: repo.branch ? branch : undefined,
    versioning: repo.branch ? looseVersioning : undefined,
    //gitRef: repo.branch ? branch : rev,
    //digestOneAndOnly: repo.branch ? true : undefined,
    //pinDigests: repo.branch ? true: undefined,

    autoReplaceStringTemplate: '{{{depName}}} {{{newValue}}}',
    //autoReplaceStringTemplate:
    //  '{{depName}}\ncommit: {{#if newDigest}}{{newDigest}}',
  };
  return packageDependency;
}

export function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  logger.info('Running KAS manager');
  logger.debug({ packageFile }, 'kas.extractPackageFile');

  let KasProjectFile: KasProject;
  try {
    logger.debug({ content }, 'kas.extractPackageFile: file content');
    KasProjectFile = parseSingleYaml(content, {
      customSchema: KasProject,
      removeTemplates: true,
    });
  } catch (err) {
    logger.debug(
      { err, packageFile },
      `kas.extractPackageFile: Parsing KAS project config YAML failed`,
    );
    return null;
  }

  const deps: PackageDependency[] = [];
  try {
    const fileFormatVersion = KasProjectFile.header.version;
    logger.debug(
      { fileFormatVersion },
      'kas.extractPackageFile: file format version',
    );
    const repos = KasProjectFile.repos;
    logger.debug({ repos }, 'kas.extractPackageFile: parsed KAS project repos');
    for (const repo of Object.values(repos)) {
      logger.debug({ repo }, 'kas.extractPackageFile');

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
      // Check if conditions are fulfilled
      if (!repo?.url) {
        logger.info({ repo }, 'kas.extractPackageFile: No repo URL found');
        continue;
      }
      if (!repo?.commit) {
        logger.info(
          { repo },
          'kas.extractPackageFile: No commit found. Not sure what to keep track of.',
        );
        continue;
      }

      if (repo?.tag) {
        logger.warn(
          { repo },
          'kas.extractPackageFile: Tracking of tags not supported, yet',
        );
        continue;
      }

      const dep = dependencyStrategy(repo);
      logger.debug({ dep }, 'kas.extractPackageFile: extracted dependency');

      deps.push(dep);
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
