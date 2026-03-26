import { vi } from 'vitest';
import { Fixtures } from '~test/fixtures.ts';
import { updateDependency } from './update.ts';

const kasFileYaml = Fixtures.get('kas-branch-commit.yml');
const replaceStringIsarYaml = Fixtures.get('replace-string-isar.yml');
const kasFileJson = Fixtures.get('kas-branch-commit.json');
const replaceStringIsarJson = Fixtures.get('replace-string-isar.json.txt');

describe('modules/manager/kas/update', () => {
  beforeAll(() => {
    vi.mock('../../../util/fs/index.ts', () => ({
      writeLocalFile: vi.fn(),
    }));
  });

  describe('updateDependency()', () => {
    it('replacing yaml file content with new digest', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.yml',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
        replaceString: replaceStringIsarYaml,
      };
      const result = await updateDependency({
        fileContent: kasFileYaml,
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('9b0816337c71c5e45998619bae351fc67fcadc45');
    });

    it('replacing yaml file content with new digest and new value', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.yml',
        datasource: 'git-refs',
        currentValue: 'next',
        newValue: 'master',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '34c3cda51b46a2a2a405e472a3c4b88c820c765e',
        replaceString: replaceStringIsarYaml,
      };
      const result = await updateDependency({
        fileContent: kasFileYaml,
        upgrade,
      });
      expect(result).toContain('master');
      expect(result).toContain('34c3cda51b46a2a2a405e472a3c4b88c820c765e');
    });

    it('returning original content if replace string is not found', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.yml',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
        replaceString: 'string-not-in-file',
      };
      const result = await updateDependency({
        fileContent: kasFileYaml,
        upgrade,
      });
      expect(result).toBe(kasFileYaml);
    });

    it('replacing json file content with new digest', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.json',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
        replaceString: replaceStringIsarJson,
      };
      const result = await updateDependency({
        fileContent: kasFileJson,
        upgrade,
      });
      expect(result).toContain('next');
      expect(result).toContain('9b0816337c71c5e45998619bae351fc67fcadc45');
    });

    it('replacing json file content with new digest and new value', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.json',
        datasource: 'git-refs',
        currentValue: 'next',
        newValue: 'master',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '34c3cda51b46a2a2a405e472a3c4b88c820c765e',
        replaceString: replaceStringIsarJson,
      };
      const result = await updateDependency({
        fileContent: kasFileJson,
        upgrade,
      });
      expect(result).toContain('master');
      expect(result).toContain('34c3cda51b46a2a2a405e472a3c4b88c820c765e');
    });

    it('returning original content if replace string is not found', async () => {
      const upgrade = {
        depName: 'isar',
        packageFile: 'kas-branch-commit.json',
        datasource: 'git-refs',
        currentValue: 'next',
        currentDigest: 'd63a1cbae6f737aa843d00d8812547fe7b87104a',
        newDigest: '9b0816337c71c5e45998619bae351fc67fcadc45',
        replaceString: 'string-not-in-file',
      };
      const result = await updateDependency({
        fileContent: kasFileJson,
        upgrade,
      });
      expect(result).toBe(kasFileJson);
    });
  });
});
