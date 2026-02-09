import { logger } from '../../../logger';
import { writeLocalFile } from '../../../util/fs';
import { regEx, escapeRegExp } from '../../../util/regex';
import { replaceAt } from '../../../util/string';
import { UpdateDependencyConfig } from '../types';

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const {
    depName,
    packageFile,
    currentValue,
    newValue,
    currentDigest,
    newDigest,
    replaceString,
  } = upgrade;
  logger.trace({ packageFile }, 'kas.updateDependency');
  let searchIndex: number;
  searchIndex = fileContent.indexOf(replaceString!);
  if (searchIndex === -1) {
    logger.debug(
      { packageFile, depName, fileContent, replaceString },
      'Cannot find replaceString in current file content. Was it already updated?',
    );
    return fileContent;
  }
  try {
    let newString = replaceString!;
    if (currentValue && newValue && currentValue !== newValue) {
      if (!newString.includes(currentValue)) {
        logger.debug(
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
        logger.debug(
          { stringToReplace: newString, currentDigest },
          'currentDigest not found in string to replace',
        );
      }
      newString = newString.replace(
        regEx(escapeRegExp(currentDigest)),
        newDigest,
      );
    }
    logger.debug(
      { packageFile, depName },
      `Starting search at index ${searchIndex}`,
    );
    let newContent = fileContent;
    newContent = replaceAt(newContent, searchIndex, replaceString!, newString);
    await writeLocalFile(upgrade.packageFile!, newContent);
    return newContent;
  } catch (err) {
    logger.debug({ packageFile, depName, err }, 'doAutoReplace error');
  }
  logger.debug(
    { packageFile, depName },
    'Did not perform any replacements in updateDependency',
  );
  return fileContent;
}
