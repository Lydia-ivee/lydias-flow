# Changelog

All notable changes, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- ESLint, Prettier and type checking of the JavaScript (TypeScript compiler in
  `checkJs` strict mode), all enforced in CI.
- `SECURITY.md`, this changelog, a pull request template and Dependabot
  updates for npm packages and GitHub Actions.

### Fixed

- A crash when the last window closed (`window-all-closed` passes no event),
  found by type checking.
- Clearer errors for an empty download response and for using the
  transcriber before it has started.

## [0.1.0] - 2026-11-22

### Added

- Hold-to-talk dictation that types at the cursor in any app, with the
  clipboard restored afterwards.
- Edit by voice: select text, hold the edit key and say the change.
- On-device speech-to-text (NVIDIA Parakeet via sherpa-onnx) and AI tidy-up
  (Qwen 3.5 2B via llama.cpp), with a guard that rejects answers containing
  words you never said.
- British English spelling mode.
- Voice snippets, on their own or mid-sentence, with `{date}`, `{time}` and
  `{clipboard}`.
- Flow Report: words, speaking speed, time saved and filler words (counts
  only).
- Network guard: the running app may only talk to itself.
- Eval suite (`npm run eval`) with a scorecard written into the README.
- Tests on a GitHub macOS runner for every push.

[Unreleased]: https://github.com/Lydia-ivee/lydias-flow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Lydia-ivee/lydias-flow/releases/tag/v0.1.0
