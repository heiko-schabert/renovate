import { GitRefsDatasource } from '../../datasource/git-refs';
//import { GitTagsDatasource } from '../../datasource/git-tags';
//import { GithubReleasesDatasource } from '../../datasource/github-releases';
//import { GithubTagsDatasource } from '../../datasource/github-tags';
//import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const displayName = 'KAS';
export const supportsLockFileMaintenance = false;

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)kas\\.yml$/', '/(^|/)kas\\.yaml$/'],
  commitMessageTopic: 'KAS',
  commitMessageExtra: 'to {{newValue}}',
  enabled: false,
};

export const supportedDatasources = [
  // GithubTagsDatasource.id,
  // GithubReleasesDatasource.id,
  // GitlabTagsDatasource.id,
  GitRefsDatasource.id,
  //  GitTagsDatasource.id,
];
