import { Fixtures } from '~test/fixtures';
import { extractPackageFile } from './extract';
import type { KasDump } from './schema';

const kasHeadTracking = Fixtures.get('kas-head-tracking.yml');
const kasBranchCommit = Fixtures.get('kas-branch-commit.yml');
const kasTag = Fixtures.get('kas-tag.yml');
const kasTagCommit = Fixtures.get('kas-tag-commit.yml');

const commitSha = 'd63a1cbae6f737aa843d00d8812547fe7b87104a';
const isarUrl = 'https://github.com/ilbers/isar.git';

function makeDump(
  repos: KasDump['repos'],
  overrides?: KasDump['overrides'],
): KasDump {
  return {
    header: { version: 1 },
    repos,
    overrides,
  } as KasDump;
}

describe('modules/manager/kas/extractPackageFile', () => {
  it('returns null when kasDump is null', async () => {
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      null,
    );
    expect(result).toBeNull();
  });

  it('returns null for invalid YAML', async () => {
    const dump = makeDump({});
    const result = await extractPackageFile(
      '{{invalid yaml',
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('returns null when no repos section exists', async () => {
    const dump = makeDump({});
    const content = 'header:\n  version: 1\n';
    const result = await extractPackageFile(
      content,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('extracts head-tracking dependency (commit only)', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
      },
    });
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: commitSha,
          currentValue: undefined,
          datasource: 'git-refs',
          packageName: isarUrl,
          versioning: undefined,
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('extracts branch + commit dependency', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
        branch: 'next',
      },
    });
    const result = await extractPackageFile(
      kasBranchCommit,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: commitSha,
          currentValue: 'next',
          datasource: 'git-refs',
          packageName: isarUrl,
          versioning: 'loose',
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('extracts tag-only dependency', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        tag: 'v0.0.1',
      },
    });
    const result = await extractPackageFile(kasTag, 'kas.yml', undefined, dump);
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: undefined,
          currentValue: 'v0.0.1',
          datasource: 'git-tags',
          packageName: isarUrl,
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('extracts tag + commit dependency', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
        tag: 'v0.0.1',
      },
    });
    const result = await extractPackageFile(
      kasTagCommit,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: commitSha,
          currentValue: 'v0.0.1',
          datasource: 'git-tags',
          packageName: isarUrl,
        },
      ],
    });
    expect(result!.deps).toHaveLength(1);
  });

  it('skips repo not present in dump', async () => {
    const dump = makeDump({});
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('skips mercurial repos', async () => {
    const content = [
      'header:',
      '  version: 1',
      'repos:',
      '  hg-repo:',
      '    url: https://example.com/repo',
      '    type: hg',
      '    commit: abc123',
    ].join('\n');
    const dump = makeDump({
      'hg-repo': {
        url: 'https://example.com/repo',
        type: 'hg',
        commit: 'abc123',
      },
    });
    const result = await extractPackageFile(
      content,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('skips when URL in file does not match dump', async () => {
    const dump = makeDump({
      isar: {
        url: 'https://example.com/different-repo.git',
        commit: commitSha,
      },
    });
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('skips when commit does not match dump', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('skips when no repo URL found for non-lock file', async () => {
    const content = [
      'header:',
      '  version: 1',
      'repos:',
      '  local-repo:',
      '    commit: abc123',
    ].join('\n');
    const dump = makeDump({
      'local-repo': {
        commit: 'abc123',
      },
    });
    const result = await extractPackageFile(
      content,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('skips when both branch and tag are defined in dump', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
        branch: 'main',
        tag: 'v1.0.0',
      },
    });
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('uses overrides commit from dump when available', async () => {
    const overriddenCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const content = [
      'header:',
      '  version: 1',
      'repos:',
      '  isar:',
      `    url: ${isarUrl}`,
      `    commit: ${overriddenCommit}`,
    ].join('\n');
    const dump = makeDump(
      {
        isar: {
          url: isarUrl,
          commit: commitSha,
        },
      },
      {
        repos: {
          isar: { commit: overriddenCommit },
        },
      },
    );
    const result = await extractPackageFile(
      content,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: overriddenCommit,
          packageName: isarUrl,
          datasource: 'git-refs',
        },
      ],
    });
  });

  it('extracts dependencies from lock file overrides section', async () => {
    const lockContent = [
      'overrides:',
      '  repos:',
      '    isar:',
      `      commit: ${commitSha}`,
    ].join('\n');
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
      },
    });
    const result = await extractPackageFile(
      lockContent,
      'project.lock.yml',
      undefined,
      dump,
    );
    expect(result).toMatchObject({
      deps: [
        {
          currentDigest: commitSha,
          datasource: 'git-refs',
          packageName: isarUrl,
        },
      ],
    });
  });

  it('returns null for lock file without overrides section', async () => {
    const lockContent = [
      'some_key:',
      '  repos:',
      '    isar:',
      `      commit: ${commitSha}`,
    ].join('\n');
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
      },
    });
    const result = await extractPackageFile(
      lockContent,
      'project.lock.yml',
      undefined,
      dump,
    );
    expect(result).toBeNull();
  });

  it('includes replaceString from YAML source range', async () => {
    const dump = makeDump({
      isar: {
        url: isarUrl,
        commit: commitSha,
      },
    });
    const result = await extractPackageFile(
      kasHeadTracking,
      'kas.yml',
      undefined,
      dump,
    );
    expect(result!.deps[0].replaceString).toBeDefined();
    expect(result!.deps[0].replaceString).toContain(isarUrl);
    expect(result!.deps[0].replaceString).toContain(commitSha);
  });
});
