# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

...

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

[unreleased]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/jperasmus/stale-while-revalidate-cache/compare/v1.1.0...v1.2.0
