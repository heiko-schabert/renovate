import { getLockFilePath, isLockFilePath } from './extract';

describe('modules/manager/kas/extract', () => {
  describe('isLockFilePath()', () => {
    it.each`
      filePath                       | expected
      ${'project.lock.yml'}          | ${true}
      ${'project.lock.yaml'}         | ${true}
      ${'project.override.lock.yml'} | ${true}
      ${'path/to/project.lock.yml'}  | ${true}
      ${'path/to/project.lock.yaml'} | ${true}
      ${'project.lock.YML'}          | ${true}
      ${'project.lock.YAML'}         | ${true}
      ${'project.lock.Yml'}          | ${true}
      ${'project.lock.json'}         | ${true}
      ${'project.yml'}               | ${false}
      ${'project.yaml'}              | ${false}
      ${'path/to/project.yml'}       | ${false}
      ${'path/to/project.yaml'}      | ${false}
      ${'project.lock'}              | ${false}
      ${''}                          | ${false}
      ${'lock.yml.bak'}              | ${false}
      ${'project.lock.bak'}          | ${false}
      ${'project.lock.yaml.bak'}     | ${false}
    `('returns $expected for "$filePath"', ({ filePath, expected }) => {
      expect(isLockFilePath(filePath)).toBe(expected);
    });
  });

  describe('getLockFilePath()', () => {
    it.each`
      filePath                  | expected
      ${'project.yml'}          | ${'project.lock.yml'}
      ${'project.yaml'}         | ${'project.lock.yaml'}
      ${'project.override.yml'} | ${'project.override.lock.yml'}
      ${'path/to/project.yml'}  | ${'path/to/project.lock.yml'}
      ${'path/to/project.yaml'} | ${'path/to/project.lock.yaml'}
      ${'project.YML'}          | ${'project.lock.YML'}
      ${'project.YAML'}         | ${'project.lock.YAML'}
      ${'project.txt'}          | ${null}
      ${'project'}              | ${null}
    `('converts "$filePath" to "$expected"', ({ filePath, expected }) => {
      expect(getLockFilePath(filePath)).toBe(expected);
    });
  });
});
