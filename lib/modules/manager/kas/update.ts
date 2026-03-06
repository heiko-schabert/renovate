import { logger } from '../../../logger/index.ts';
import { writeLocalFile } from '../../../util/fs/index.ts';
import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { replaceAt } from '../../../util/string.ts';
import type { UpdateDependencyConfig } from '../types.ts';

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const {
    depName,
    packageFile,
    datasource,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
  } = upgrade;
  logger.debug({ packageFile }, 'kas.updateDependency');
  if (datasource === 'git-tags' && currentValue === newValue) {
    logger.debug(
      { packageFile, depName, currentValue, newDigest },
      'git tag version did not change. Skipping digest update.',
    );
    return fileContent;
  }
  const replaceString = upgrade.replaceString ?? currentDigest;
  const searchIndex: number = fileContent.indexOf(replaceString!);
  if (searchIndex === -1) {
    logger.warn(
      { packageFile, depName, fileContent, replaceString },
      'Cannot find replaceString in current file content.',
    );
    return fileContent;
  }
  try {
    let newString = replaceString!;
    if (currentValue && newValue && currentValue !== newValue) {
      if (!newString.includes(currentValue)) {
        logger.trace(
          { stringToReplace: newString, currentValue },
          'currentValue not found in string to replace',
        );
      }
      newString = newString.replace(
        regEx(escapeRegExp(currentValue)),
        newValue,
      );
    }
    if (currentDigest && newDigest && currentDigest !== newDigest) {
      if (!newString.includes(currentDigest)) {
        logger.trace(
          { stringToReplace: newString, currentDigest },
          'currentDigest not found in string to replace',
        );
      }
      newString = newString.replace(
        regEx(escapeRegExp(currentDigest)),
        newDigest,
      );
    }
    logger.trace(
      { packageFile, depName },
      `Starting search at index ${searchIndex}`,
    );
    let newContent = fileContent;
    newContent = replaceAt(newContent, searchIndex, replaceString!, newString);
    if (newContent === fileContent) {
      logger.warn(
        { packageFile, depName },
        'Replacement did not change file content',
      );
      return fileContent;
    }
    await writeLocalFile(upgrade.packageFile!, newContent);
    return newContent;
  } catch (err) {
    logger.warn({ packageFile, depName, err }, 'update Dependency error');
    return fileContent;
  }
}
