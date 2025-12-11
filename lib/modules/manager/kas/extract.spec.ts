import { Fixtures } from '~test/fixtures';
import { extractPackageFile } from '.';

const kasProject = Fixtures.get('kas-head-tracking.yml');

describe('modules/manager/kas/extract', () => {
  describe('extractPackageFile()', () => {
    let filename: string;

    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', '')).toBeNull();
    });
  });
});
