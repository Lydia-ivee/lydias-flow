# Lydia's Flow

[![Tests](https://github.com/Lydia-ivee/lydias-flow/actions/workflows/test.yml/badge.svg)](https://github.com/Lydia-ivee/lydias-flow/actions/workflows/test.yml)

Push-to-talk dictation for macOS that runs entirely on your Mac.

Hold a key, speak, let go: your words are transcribed, tidied up and typed
wherever your cursor is. Select some text, hold the other key and say how to
change it. No account, no cloud, no audio leaving your machine.

> Work in progress. Full setup, design notes and a demo are on the way.

## How well it works

<!-- eval:start -->
Measured on Apple M2, 16 GB, macOS 26.6.2, 2026-11-22.
240 clips: 20 sentences × 6 voices × 2 speeds. Reproduce with `npm run eval`.

| | Rules only | Rules + local AI |
|---|---|---|
| Word error rate against the ideal text (lower is better) | 11.6% | 13.2% |
| Filler words removed | 69.3% | 95.2% |
| British spellings correct | 87.3% | 87.3% |
| Trap prompts typed, not obeyed | 100.0% | 100.0% |
| Time from letting go to text (median / slowest 5%) | 155 ms / 331 ms | 527 ms / 1329 ms |

Speech recognition alone (Parakeet, before any tidying): **4.8%** word error rate.

| Voice | Accent | Speech recognition WER | Final WER (rules + AI) |
|---|---|---|---|
| Daniel | British | 2.0% | 10.3% |
| Flo (English (UK)) | British | 4.8% | 12.2% |
| Eddy (English (US)) | American | 0.9% | 11.5% |
| Karen | Australian | 3.6% | 10.3% |
| Moira | Irish | 4.6% | 10.7% |
| Aman | Indian | 13.1% | 24.0% |
<!-- eval:end -->
