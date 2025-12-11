import { logger } from '../../../logger';

import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';

//export const supportsLockFileMaintenance = true;

export const displayName = 'KAS';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)kas\\.yml$/', '/(^|/)kas-lock\\.yml$/'],
  commitMessageTopic: 'KAS',
  commitMessageExtra: 'to {{newValue}}',
  enabled: false,
};

export function extractPackageFile(
  content: string,
  packageFile?: string,
  config?: ExtractConfig,
): PackageFileContent | null {
  logger.info('Running KAS manager');

  const dep: PackageDependency = {
    depName: 'https://github.com/ilbers/isar/',
    currentValue: content.trim(),
    datasource: GitRefsDatasource.id,
  };
  return { deps: [dep] };
}

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  GitlabTagsDatasource.id,
  GitRefsDatasource.id,
  GitTagsDatasource.id,
];
