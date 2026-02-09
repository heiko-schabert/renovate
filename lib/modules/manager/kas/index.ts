import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
export { extractAllPackageFiles } from './extract';
export { updateDependency } from './update';

export const displayName = 'KAS';
export const supportsLockFileMaintenance = false;
export const url = 'https://kas.readthedocs.io/en/latest/';

export const defaultConfig = {
  commitMessageTopic: 'KAS',
  commitMessageExtra: 'to {{newValue}}',
  enabled: false,
};

export const supportedDatasources = [
  GitRefsDatasource.id,
  GitTagsDatasource.id,
];
