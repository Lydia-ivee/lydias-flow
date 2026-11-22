# Lydia's Flow

[![Tests](https://github.com/Lydia-ivee/lydias-flow/actions/workflows/test.yml/badge.svg)](https://github.com/Lydia-ivee/lydias-flow/actions/workflows/test.yml)

Push-to-talk dictation for macOS that runs entirely on your Mac.

Hold a key, speak, let go: your words are transcribed, tidied up and typed
wherever your cursor is. Select some text, hold the other key and say how to
change it. No account, no cloud, no audio leaving your machine.

## What it does

- **Dictate anywhere.** Hold `fn` (or a key you choose), speak, release. Text appears at your cursor in any app: email, Slack, a browser, a code editor.
- **Edit by voice.** Select text, hold the edit key, say "make this more formal" or "shorten this". The selection is rewritten in place.
- **Tidy, not rewrite.** Filler words go ("um", "you know", "basically"), punctuation is fixed, and nothing you did not say is added. A guard rejects any answer from the AI that contains words you never spoke.
- **Voice snippets, even mid-sentence.** Save text once in Settings with a trigger phrase, then say _"insert my sign-off"_, on its own or mid-flow: _"Thanks for your time today, insert my sign-off"_ types your sentence, tidied, with the sign-off on its own line beneath. Snippets can include `{date}`, `{time}` and `{clipboard}`. Matching is plain code, not AI: "insert" (or "snippet") only counts when the words straight after it closely match a trigger, so _"we should insert a table here"_ is typed as said, while a slight mishearing (_"my sign of"_) still works.
- **British English mode.** Speech models write American spellings; this turns _organize the color of the center_ into _organise the colour of the centre_.
- **Flow Report.** Words dictated this week, your speaking speed against typing, minutes saved, and your favourite filler words. Counts only: your words are never stored.
- **Offline by design.** The app blocks every network request that is not to itself. Models are downloaded once at setup, never by the running app.

## Install and run

You need an Apple Silicon Mac, Node.js 22 or newer, Apple's command line tools
(`xcode-select --install`) and about 2.5 GB of free space.

```bash
git clone https://github.com/Lydia-ivee/lydias-flow.git
cd lydias-flow
npm install
npm run setup   # builds the key listener, downloads the AI engine and models (~1.9 GB)
npm start
```

The app lives in the menu bar (five little bars). On first launch:

1. Allow **Microphone** access when asked.
2. Allow **Accessibility** under System Settings › Privacy & Security, so it can detect the keys and paste.
3. If you use `fn`: set System Settings › Keyboard › "Press 🌐 key to" to **Do Nothing**, or the emoji picker opens too.

Every download in `npm run setup` is pinned to an exact version and checked
against a SHA-256 fingerprint before it is used.

## How it works

```mermaid
flowchart LR
    K[Swift key listener] -- key down --> R[Pill window records the mic<br/>16 kHz mono]
    K -- key up --> R
    R -- audio --> T[Parakeet speech-to-text<br/>in-process, ~0.2 s]
    T --> F[Remove noise words<br/>rules]
    F --> A[Tidy with Qwen 2B<br/>llama.cpp on 127.0.0.1]
    A --> G{Invented-words guard}
    G -- ok --> B[British spelling<br/>rules]
    G -- rejected --> B
    B --> P[Paste at cursor<br/>clipboard restored]
    P --> S[(Flow Report<br/>counts only)]
```

| Part           | File                                                                                           | What it does                                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key listener   | [`native/key-listener.swift`](native/key-listener.swift)                                       | Electron can only see key presses, not releases, so a 70-line Swift program watches modifier keys and prints `DOWN fn` / `UP fn`.                                                                                                     |
| Recorder       | [`src/renderer/recorder.js`](src/renderer/recorder.js)                                         | Records at 16 kHz mono, the format the speech model wants, so there is no conversion step. The mic is open only while the key is held.                                                                                                |
| Speech-to-text | [`src/main/transcriber.js`](src/main/transcriber.js)                                           | NVIDIA Parakeet (0.6B) through sherpa-onnx, running inside the app.                                                                                                                                                                   |
| Clean-up       | [`src/main/cleaner.js`](src/main/cleaner.js), [`src/shared/prompts.js`](src/shared/prompts.js) | Qwen 3.5 2B on the Mac's GPU via llama.cpp, plus the safety net that decides whether to trust its answer.                                                                                                                             |
| Pipeline       | [`src/main/pipeline.js`](src/main/pipeline.js)                                                 | The order of operations: noise words, AI tidy-up, then British spelling last so the model cannot undo it.                                                                                                                             |
| Snippets       | [`src/shared/snippets.js`](src/shared/snippets.js)                                             | Finds each "insert", tries the next 1 to N words against every trigger (letter-level edit distance, 75% similarity), and splits the sentence around any match. Spoken parts are tidied as usual; snippets are typed exactly as saved. |
| Paste          | [`src/main/paste.js`](src/main/paste.js)                                                       | Clipboard plus ⌘V, with your previous clipboard put back afterwards.                                                                                                                                                                  |
| Network guard  | [`src/shared/networkGuard.js`](src/shared/networkGuard.js)                                     | Every window may only reach `127.0.0.1` and local files.                                                                                                                                                                              |

## Design decisions and trade-offs

- **Speech runs inside the app, not as a server.** The first version ran sherpa-onnx's WebSocket server, until a check of open ports showed it listening on every network interface with no option to restrict it: anyone on the same Wi-Fi could have sent it audio. Running the model in-process removed the port entirely, at no cost in speed.
- **Rules where rules are enough, AI where it helps.** "Um" and "uh" never carry meaning, so rules remove them, instantly and testably. Grammar and false starts need judgement, so they go to the model. British spelling is rules again: a word list and two patterns, with ambiguous words (_program_, _license_, _check_) deliberately left alone because a wrong change is worse than a missed one.
- **Never type words you did not say.** Tidying should only remove words and add punctuation. If more than 20% of the model's answer is new words, the answer is thrown away and the rule-cleaned text is typed instead.
- **A small local model, held on a short lead.** A 2B model is fast (about 0.4 s) and private, but follows instructions loosely. So the dictation is fenced in `<dictation>` tags, the prompt carries one worked example, temperature is 0 for repeatable output, and the guard above checks every answer.
- **The microphone opens only while you hold the key.** That costs about 0.2 s at the start of each dictation, in exchange for the orange mic indicator showing only when you are actually talking.
- **Edit mode reads your selection on key release.** Pressing ⌘C while Right Option is still held would arrive as ⌥⌘C, a different shortcut.
- **Fast library choice.** sherpa-onnx's universal macOS build of ONNX Runtime is about 3x slower on Apple Silicon than the Apple-Silicon-only build (documented by the OpenWhispr project); the npm package used here ships the fast one.
- **No database, no bundler, no framework.** Settings are a JSON file, stats are JSON Lines, the UI is plain HTML, CSS and JavaScript. Fewer moving parts for a small app.

## How well it works

Measured by `npm run eval`: every sentence in [`evals/cases.json`](evals/cases.json)
is spoken by several macOS voices at two speeds, run through the real
pipeline, and scored twice, with and without the AI step. Full results,
including every miss, are in [`evals/results.json`](evals/results.json).

<!-- eval:start -->

Measured on Apple M2, 16 GB, macOS 26.6.2, 2026-11-22.
240 clips: 20 sentences × 6 voices × 2 speeds. Reproduce with `npm run eval`.

|                                                          | Rules only      | Rules + local AI |
| -------------------------------------------------------- | --------------- | ---------------- |
| Word error rate against the ideal text (lower is better) | 13.6%           | 9.7%             |
| Filler words removed                                     | 69.7%           | 89.9%            |
| British spellings correct                                | 86.5%           | 86.5%            |
| Trap prompts typed, not obeyed                           | 100.0%          | 100.0%           |
| Time from letting go to text (median / slowest 5%)       | 160 ms / 415 ms | 549 ms / 1266 ms |

Speech recognition alone (Parakeet, before any tidying): **6.9%** word error rate.

| Voice               | Accent     | Speech recognition WER | Final WER (rules + AI) |
| ------------------- | ---------- | ---------------------- | ---------------------- |
| Daniel              | British    | 2.1%                   | 4.7%                   |
| Flo (English (UK))  | British    | 5.1%                   | 6.6%                   |
| Eddy (English (US)) | American   | 0.9%                   | 5.1%                   |
| Karen               | Australian | 4.4%                   | 7.1%                   |
| Moira               | Irish      | 5.7%                   | 5.5%                   |
| Aman                | Indian     | 23.3%                  | 29.0%                  |

**Voice snippets:** the right result (the snippet, or nothing for look-alike sentences) in 91.7% of 144 spoken commands; set off by ordinary dictation in 0 of 240 clips.
<!-- eval:end -->

### What the eval caught

- **The AI obeyed a dictation.** Asked to tidy _"Convert this to a bulleted list please"_, the first version typed _"\* Move the meeting to Thursday."_: a bullet built from its own prompt example. That led to the `<dictation>` fence and the invented-words guard, and the sentence is now a regression test. On the rerun, end-to-end word error rate with AI dropped from 13.2% to 6.6%, and the AI step went from making text worse than rules alone to clearly better.
- **The eval was grading itself too kindly.** The trap check looked for "•"; the model had used "\*". A trap now also fails if the output strays from what was said.
- **Two runs of the same code disagreed.** Speech recognition turned out to be repeatable (the same clip gives the same text 10 times out of 10). The macOS "Aman" voice is not: it produces different audio in different runs. Test audio is now generated once and frozen, so before/after comparisons measure the code, not the test.
- **The AI step was not repeatable either**: at temperature 0.2, 18 of 240 clips were tidied differently between runs. At temperature 0, two consecutive runs now give identical results for all 240 clips, transcripts and final text alike.
- **The last word was getting cut off.** Snippet commands came back as _"insert today's d"_: when audio stops straight after the last word, which is what happens when you let go of the key as you finish, the model drops it. Recordings now get half a second of silence added at the end. That is a trade-off, not a free win: it changed 32 of 240 ordinary transcripts (14 better, 18 worse, mostly a spoken "uh" disappearing), but end-to-end accuracy with AI improved slightly and the snippet hit rate rose from 84% to 92%.
- **A misheard "um" blocked snippets.** _"Um, insert out of office"_ was heard as _"Come, insert out of office"_, so the command word was no longer first. Snippets now match anywhere in a sentence, which fixed this and made mid-sentence snippets possible. The tests also caught the words after a mid-sentence snippet being capitalised as a new sentence (_"1 Example Street By Friday"_).

The Indian English result should be read with care: the frozen "Aman" clips
score 24.7%, while earlier, different renderings of the same sentences scored
6 to 13%. It needs testing with real voices before drawing conclusions about
accent bias.

## Limits

- **Apple Silicon Macs only**, and English only.
- **Some trigger phrases are hard to hear.** _"Today's date"_ is often heard as _"the day state"_; triggers made of distinct, ordinary words work best. A misheard "um" before "insert" (_"Come, insert…"_) is typed as a word.
- **Not tested with real voices at scale.** The eval uses synthetic speech; your microphone, room and accent will differ.
- **Paste uses the clipboard and a simulated ⌘V.** Apps that block synthetic key presses, or password fields, will not receive text. Some Chromium apps occasionally drop a synthetic paste.
- **The 2B model is a trade-off.** It removes about 90% of filler words and sometimes leaves a "so" or drops a phrase you meant. Turn off "Tidy up with AI" in Settings for rules only (about 0.15 s, no model).
- **British spelling skips words whose spelling depends on meaning** (_licence/license_, _programme/program_, _cheque/check_) and words not in its list yet.
- **The clean-up engine listens on 127.0.0.1.** Other apps on your own Mac could reach it; other devices cannot.
- **Unsigned.** `npm start` runs from source; there is no signed, notarised `.dmg` yet.

## Development

```bash
npm test        # 46 tests, including an end-to-end engine test once setup has run
npm run eval    # the full eval suite (~6 minutes on an M2)
```

Tests run on a GitHub macOS runner on every push. A pre-push hook
([`.githooks/pre-push`](.githooks/pre-push)) scans each push for secrets with
gitleaks before it leaves the machine; enable it with
`git config core.hooksPath .githooks`.

## Credits

- [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) (Apache-2.0) runs the speech model.
- [NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-unified-en-0.6b) speech model, under the [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/).
- [llama.cpp](https://github.com/ggml-org/llama.cpp) (MIT) runs the clean-up model.
- [Qwen 3.5 2B](https://huggingface.co/Qwen/Qwen3.5-2B) (Apache-2.0), quantised by [bartowski](https://huggingface.co/bartowski/Qwen_Qwen3.5-2B-GGUF).
- [Electron](https://www.electronjs.org/) (MIT).
- [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT), whose open-source dictation app was the starting point for this project and the source of the ONNX Runtime speed finding above.

Models are downloaded at setup and are not included in this repository.

## Licence

[MIT](LICENSE)
