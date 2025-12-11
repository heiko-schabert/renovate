import { isString, isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger';

import { regEx } from '../../../util/regex';
import { MavenDatasource } from '../../datasource/maven';
import type { PackageDependency, PackageFileContent } from '../types';

const dependsOnRegex = regEx(
  /@file\s*:\s*DependsOn\s*\(\s*(?<replaceString>"(?<groupId>.+):(?<artifactId>.+):(?<version>.+)")\s*\)/g,
);
const repositoryRegex = regEx(
  /@file\s*:\s*Repository\s*\(\s*"(?<repositoryName>.+)"\s*\)/g,
);

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  logger.debug('Running KAS manager');

  return null;
}
