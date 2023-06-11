# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

...

## [3.1.2] - 2023-06-11

### Fixed

- Transpiled away any uses of the nullish coalescing operator (`??`) since Webpack 4 doesn't support it

## [3.1.1] - 2023-05-10

### Fixed

- Update main cache value type to reflect that the awaited value is stored

## [3.1.0] - 2023-02-14

### Added

- Expose a `.delete()` convenience method to manually remove cache entries

## [3.0.0] - 2023-02-09

### Changed

- Return type from `swr` cache function now returns a payload object containing the cache value and not just the cache value.
- Event emitter events that used `cachedTime` changed to `cachedAt`
- `swr.persist()` function now throws if an error occurs while writing to storage

## [2.2.0] - 2023-02-06

### Added

- Expose a `.persist()` convenience method to manually write to the cache

## [2.1.0] - 2023-01-26

### Added

- Partial overrides of any cache config values per function invocation.

## [2.0.0] - 2022-10-28

### Removed

- Dropped support for Node.js v12

### Security

- Updated dependencies with potential security vulnerabilities

### Changed

- Internal build tools from the unmaintained TSDX to Rollup, Jest, ESLint & Prettier

## [1.2.0] - 2021-10-08

### Fixed

- Fix incorrect emitting of `cacheExpired` event

### Added

- Add `cacheStale` event
- Allow falsy cache values excluding `null` and `undefined`

## [1.1.0] - 2021-10-01

### Added

- Add emitter events for when storage get and set fails

[unreleased]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v3.1.2...HEAD
[3.1.2]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v3.1.1...v3.1.2
[3.1.1]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v3.1.0...v3.1.1
[3.1.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v2.2.0...v3.0.0
[2.2.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v1.1.0...v1.2.0
