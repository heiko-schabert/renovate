# New package manager questionnaire

Did you read our documentation on adding a package manager?

- [x] I've read the [adding a package manager](adding-a-package-manager.md) documentation.

## Basics

### What's the name of the package manager?

Kas

### What language(s) does this package manager support?

Kas is a setup tool for Bitbake-based projects, primarily used in embedded Linux development.

### How popular is this package manager?

Currently, 527 stars on GitHub, and 192 forks.

### Does this language have other (competing?) package managers?

- [x] Yes (give names).
- [ ] No.

`bitbake-setup`

### What are the big selling points for this package manager?

This tool provides an easy mechanism to setup bitbake based projects.

Key features provided by the build tool:

- clone and checkout bitbake layers
- create default bitbake settings (machine, arch, ...)
- launch minimal build environment, reducing risk of host contamination
- initiate bitbake build process

See the [kas documentation](https://kas.readthedocs.io/) for further details.

Explain how this package manager is different from existing ones.

As of today, KAS is more feature-rich than bitbake-setup.

## Detecting package files

### What kind of package files, and names, does this package manager use?

kas can use yaml and json files, so `*.yml`, `*.yaml` and `*.json`.

### Which [`managerFilePatterns`](../usage/configuration-options.md#managerfilepatterns) pattern(s) should Renovate use?

Probably something like `['/(^|/)kas\\.yml$/', '/(^|/)kas\\.yaml$/']`.
Alternatively, we could choose not to set a default pattern and allow users to completely decide their `FilePatterns`.

### Do many users need to extend the [`managerFilePatterns`](../usage/configuration-options.md#managerfilepatterns) pattern for custom file names?

- [x] Yes, provide details.
- [ ] No.

Users often name their Kas files according to their project or specific build configurations.

### Is the [`managerFilePatterns`](../usage/configuration-options.md#managerfilepatterns) pattern going to get many "false hits" for files that have nothing to do with package management?

IMHO not.

## Parsing and Extraction

### Can package files have "local" links to each other that need to be resolved?

Yes, Kas files can include other kas files using the `includes` keyword.
These can be local file paths or paths to other repos and can override other values.

### Package file parsing method

The package files should be:

- [x] Parsed together (in serial).
- [ ] Parsed independently.

### Which format/syntax does the package file use?

- [x] JSON
- [ ] TOML
- [x] YAML
- [ ] Custom (explain below)

### How should we parse the package files?

- [x] Off the shelf parser.
- [ ] Using regex.
- [ ] Custom-parsed line by line.
- [ ] Other.

### Does the package file have different "types" of dependencies?

- [ ] Yes, production and development dependencies.
- [x] No, all dependencies are treated the same.

### List all the sources/syntaxes of dependencies that can be extracted

Kas files define repos and their versions. The relevant parts are the URL, tag, branch and commit.

Example:

```
repos:
  poky:
    url: https://git.yoctoproject.org/poky.git
    tag: yocto-5.1.1
    commit: 7e081bd98fdc5435e850d1df79a5e0f1e30293d0
    ...
  ...
```

See the [configuration documentation](https://kas.readthedocs.io/en/latest/userguide/project-configuration.html) and the [json schema](https://github.com/siemens/kas/blob/master/kas/schema-kas.json) for further details.

### Describe which types of dependencies above are supported and which will be implemented in future

The plan is to support all cases.

## Versioning

### What versioning scheme does the package file(s) use?

git commits, tags and branches.

### Does this versioning scheme support range constraints, like `^1.0.0` or `1.x`?

- [ ] Supports range constraints (for example: `^1.0.0` or `1.x`), provide details.
- [x] No.

## Lookup

### Is a new datasource required?

- [ ] Yes, provide details.
- [x] No.

### Will users want (or need to) set a custom host or custom registry for Renovate's lookup?

- [ ] Yes, provide details.
- [x] No.

Where can Renovate find the custom host/registry?

- [x] No custom host or registry is needed.
- [ ] In the package file(s), provide details.
- [ ] In some other file inside the repository, provide details.
- [ ] User needs to configure Renovate where to find the information, provide details.

### Are there any constraints in the package files that Renovate should use in the lookup procedure?

- [ ] Yes, there are constraints on the parent language (for example: supports only Python `v3.x`), provide details.
- [ ] Yes, there are constraints on the parent platform (for example: only supports Linux, Windows, etc.), provide details.
- [ ] Yes, some other kind of constraint, provide details.
- [x] No constraints.

### Will users need the ability to configure language or other constraints using Renovate config?

- [ ] Yes, provide details.
- [x] No.

## Artifacts

### Does the package manager use a lock file or checksum file?

- [x] Yes, uses lock file.
- [ ] Yes, uses checksum file.
- [ ] Yes, uses lock file _and_ checksum file.
- [ ] No lock file or checksum.

### Is the locksum or checksum mandatory?

- [ ] Yes, locksum is mandatory.
- [ ] Yes, checksum is mandatory.
- [ ] Yes, lock file _and_ checksum are mandatory.
- [x] No mandatory locksum or checksum.
- [ ] Package manager does not use locksums or checksums.

### If lockfiles or checksums are used: what tool and exact commands should Renovate use to update one (or more) package versions in a dependency file?

`kas lock --update kas.yml`

### Package manager cache

#### Does the package manager use a cache?

- [ ] Yes, provide details.
- [x] No.

#### If the package manager uses a cache, how can Renovate control the cache?

- [x] Package manager does not use a cache.
- [ ] Controlled via command line interface, provide details.
- [ ] Controlled via environment variables, provide details.

#### Should Renovate keep a cache?

- [ ] Yes, ignore/disable the cache.
- [x] No.

### Generating a lockfile from scratch

Renovate can perform "lock file maintenance" by getting the package manager to generate a lockfile from scratch.
Can the package manager generate a lockfile from scratch?

- [ ] Yes, explain which command Renovate should use to generate the lockfile.
- [x] No, the package manager does _not_ generate a lockfile from scratch.
- [ ] No, the package manager does not use lockfiles.

## Other

### What else should we know about this package manager?
