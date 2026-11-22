# Security

Lydia's Flow hears everything you dictate, so security and privacy problems
are taken seriously.

## Reporting a problem

Please report security issues privately using GitHub's
**Report a vulnerability** button on the
[Security tab](https://github.com/Lydia-ivee/lydias-flow/security), not in a
public issue. Include what you found, how to reproduce it, and what an
attacker could do with it. You will get a reply within a week.

## What the app promises

- **No network.** The running app only talks to itself (`127.0.0.1` and local
  files); every other request is blocked by
  [`src/shared/networkGuard.js`](src/shared/networkGuard.js). A request that
  gets past it is a security bug.
- **No stored words.** Dictated text is never written to disk. The Flow Report
  file holds counts only (words, durations, filler counts).
- **Pinned downloads.** Every file fetched by `npm run setup` is pinned to an
  exact URL and checked against a SHA-256 fingerprint before use.
- **Clipboard restored.** Paste uses the clipboard and puts your previous
  clipboard contents back afterwards.

## Known limits

- The clean-up engine (llama.cpp) listens on `127.0.0.1`, so other programs on
  the same Mac can reach it. Other devices cannot.
- The app is not code-signed or notarised.
