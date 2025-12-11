import { isNonEmptyArray } from '@sindresorhus/is';
import { logger } from '../../../logger';

import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { getSiblingFileName } from '../../../util/fs';

export function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): UpdateArtifactsResult[] | null {
  logger.debug(`kas.updateArtifacts: ${packageFileName}`);
  const { isLockFileMaintenance } = config;

  if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated KAS deps - returning null');
    return null;
  }

  try {
    logger.info(
      `kas.updateArtifacts: Updated KAS project file content written: ${packageFileName}`,
    );
    const updateArtifactsResult: UpdateArtifactsResult[] = [];
    return updateArtifactsResult;
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    const lockFileName = getSiblingFileName(packageFileName, 'kas-lock.yml');
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${err}`,
        },
      },
    ];
  }
}
