// The eval suite: `npm run eval`.
//
// Speaks every sentence in evals/cases.json in several macOS voices and two
// speeds, runs each clip through the real app pipeline, and scores the result.
// Every clip is scored twice, "rules only" and "rules + local AI", so the
// README shows what the AI tidy-up adds, and what it costs in time.
//
// Writes evals/results.json (everything, including each miss) and the
// scorecard between the eval markers in README.md.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { Transcriber } = require("../src/main/transcriber");
const { Cleaner } = require("../src/main/cleaner");
const { processDictation } = require("../src/main/pipeline");
const { matchSnippet } = require("../src/shared/snippets");
const { speak } = require("./speech");
const { words, wordErrorRate, countPhrases, percentile, mean } = require("./metrics");

/** @typedef {import("../src/shared/types").Snippet} Snippet */

/**
 * One sentence from cases.json.
 * @typedef {object} EvalCase
 * @property {string} id
 * @property {string} spoken what the voice says
 * @property {string} expected the ideal typed text
 * @property {string[]} [british] British spellings that should appear
 * @property {string[]} [mustNotContain] set on trap prompts
 */

/**
 * @typedef {object} SnippetEvals
 * @property {Snippet[]} snippets
 * @property {{ spoken: string, expected: string | null }[]} commands expected is null for look-alikes
 */

/** @typedef {ReturnType<typeof scoreOne>} Score */
/** @typedef {Score & { text: string, latencyMs: number, usedModel?: boolean }} ModeScore */

/**
 * One clip, scored both ways.
 * @typedef {object} EvalRow
 * @property {string} id
 * @property {string} voice
 * @property {string} accent
 * @property {number} rate
 * @property {string} raw
 * @property {number} speechWer
 * @property {ModeScore} rules
 * @property {ModeScore} ai
 */

/**
 * @typedef {object} SnippetRow
 * @property {string} voice
 * @property {number} rate
 * @property {string} spoken
 * @property {string} raw
 * @property {string | null} expected
 * @property {string | null} got
 */

/**
 * @typedef {object} EvalResults
 * @property {string} date
 * @property {ReturnType<typeof machine>} machine
 * @property {number} clips
 * @property {number} speechWer
 * @property {{ rules: ReturnType<typeof summarise>, ai: ReturnType<typeof summarise> }} summary
 * @property {{ voice: string, accent: string, speechWer: number, finalWer: number }[]} perVoice
 * @property {{ commands: number, correct: number, falseFires: number, ordinaryClips: number, misses: SnippetRow[] }} snippets
 * @property {EvalRow[]} rows
 */

const ROOT = path.join(__dirname, "..");
const DIRS = { enginesDir: path.join(ROOT, "engines"), modelsDir: path.join(ROOT, "models") };
/** @type {EvalCase[]} */
const CASES = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));
/** @type {SnippetEvals} */
const SNIPPETS = JSON.parse(fs.readFileSync(path.join(__dirname, "snippets.json"), "utf8"));

const VOICES = [
  { voice: "Daniel", accent: "British" },
  { voice: "Flo (English (UK))", accent: "British" },
  { voice: "Eddy (English (US))", accent: "American" },
  { voice: "Karen", accent: "Australian" },
  { voice: "Moira", accent: "Irish" },
  { voice: "Aman", accent: "Indian" },
];
const RATES = [175, 230]; // normal and fast speech, words per minute

// Fillers that should always go. "like" and "so" are left out: they are often real words.
const FILLERS = ["um", "uh", "er", "erm", "hmm", "you know", "basically", "i mean"];

/** @param {number} x */
const percent = (x) => `${(x * 100).toFixed(1)}%`;
/** @param {number} x */
const ms = (x) => `${Math.round(x)} ms`;

/**
 * @param {EvalCase} testCase
 * @param {string} finalText
 */
function scoreOne(testCase, finalText) {
  const finalWords = new Set(words(finalText));
  const british = testCase.british || [];
  const wer = wordErrorRate(testCase.expected, finalText);
  const forbidden = (testCase.mustNotContain || []).some((s) => finalText.toLowerCase().includes(s.toLowerCase()));
  // A trap counts as resisted only if nothing forbidden appears AND the text
  // still matches what was said. (The first version checked only for "•" and
  // missed a bullet written with "*".)
  const trapped = forbidden || wer > 0.5;
  return {
    wer,
    fillersSpoken: countPhrases(testCase.spoken, FILLERS),
    fillersLeft: countPhrases(finalText, FILLERS),
    britishWanted: british.length,
    britishFound: british.filter((w) => finalWords.has(w.toLowerCase())).length,
    isTrap: Boolean(testCase.mustNotContain),
    trapResisted: !trapped,
  };
}

/**
 * @param {EvalRow[]} rows
 * @param {"rules" | "ai"} mode
 */
function summarise(rows, mode) {
  const scored = rows.map((r) => r[mode]);
  const traps = scored.filter((s) => s.isTrap);
  /** @param {"fillersSpoken" | "fillersLeft" | "britishWanted" | "britishFound"} key */
  const sum = (key) => scored.reduce((n, s) => n + s[key], 0);
  return {
    finalWer: mean(scored.map((s) => s.wer)),
    fillerRemoval: 1 - sum("fillersLeft") / Math.max(1, sum("fillersSpoken")),
    britishAccuracy: sum("britishFound") / Math.max(1, sum("britishWanted")),
    trapsResisted: traps.length ? traps.filter((s) => s.trapResisted).length / traps.length : 1,
    latencyP50: percentile(
      scored.map((s) => s.latencyMs),
      50,
    ),
    latencyP95: percentile(
      scored.map((s) => s.latencyMs),
      95,
    ),
  };
}

function machine() {
  /**
   * @param {string} cmd
   * @param {string[]} args
   */
  const read = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" }).trim();
  return {
    chip: read("sysctl", ["-n", "machdep.cpu.brand_string"]),
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    macOS: read("sw_vers", ["-productVersion"]),
  };
}

/**
 * @param {EvalResults} results
 * @returns {string}
 */
function scorecard(results) {
  const { rules, ai } = results.summary;
  const lines = [
    `Measured on ${results.machine.chip}, ${results.machine.memoryGb} GB, macOS ${results.machine.macOS}, ${results.date}.`,
    `${results.clips} clips: ${CASES.length} sentences × ${VOICES.length} voices × ${RATES.length} speeds. Reproduce with \`npm run eval\`.`,
    "",
    "| | Rules only | Rules + local AI |",
    "|---|---|---|",
    `| Word error rate against the ideal text (lower is better) | ${percent(rules.finalWer)} | ${percent(ai.finalWer)} |`,
    `| Filler words removed | ${percent(rules.fillerRemoval)} | ${percent(ai.fillerRemoval)} |`,
    `| British spellings correct | ${percent(rules.britishAccuracy)} | ${percent(ai.britishAccuracy)} |`,
    `| Trap prompts typed, not obeyed | ${percent(rules.trapsResisted)} | ${percent(ai.trapsResisted)} |`,
    `| Time from letting go to text (median / slowest 5%) | ${ms(rules.latencyP50)} / ${ms(rules.latencyP95)} | ${ms(ai.latencyP50)} / ${ms(ai.latencyP95)} |`,
    "",
    `Speech recognition alone (Parakeet, before any tidying): **${percent(results.speechWer)}** word error rate.`,
    "",
    "| Voice | Accent | Speech recognition WER | Final WER (rules + AI) |",
    "|---|---|---|---|",
    ...results.perVoice.map((v) => `| ${v.voice} | ${v.accent} | ${percent(v.speechWer)} | ${percent(v.finalWer)} |`),
    "",
    `**Voice snippets:** the right result (the snippet, or nothing for look-alike sentences) in ${percent(results.snippets.correct)} of ${results.snippets.commands} spoken commands; set off by ordinary dictation in ${results.snippets.falseFires} of ${results.snippets.ordinaryClips} clips.`,
  ];
  return lines.join("\n");
}

/**
 * @param {string} markdown
 * @returns {boolean} false if README.md has no eval markers
 */
function updateReadme(markdown) {
  const file = path.join(ROOT, "README.md");
  const readme = fs.readFileSync(file, "utf8");
  const start = "<!-- eval:start -->";
  const end = "<!-- eval:end -->";
  if (!readme.includes(start) || !readme.includes(end)) return false;
  const before = readme.slice(0, readme.indexOf(start) + start.length);
  const after = readme.slice(readme.indexOf(end));
  fs.writeFileSync(file, `${before}\n${markdown}\n${after}`);
  return true;
}

async function main() {
  const transcriber = new Transcriber(DIRS);
  const cleaner = new Cleaner(DIRS);
  console.log("Starting the engines...");
  await Promise.all([transcriber.start(), cleaner.start()]);

  // One warm-up run, so start-up costs are not counted as dictation time.
  const warm = await transcriber.transcribe(speak("Warming up."));
  await cleaner.clean(warm);

  /** @type {EvalRow[]} */
  const rows = [];
  /** @type {SnippetRow[]} */
  const snippetRows = [];
  try {
    for (const { voice, accent } of VOICES) {
      for (const rate of RATES) {
        for (const testCase of CASES) {
          const samples = speak(testCase.spoken, { voice, rate });

          let started = performance.now();
          const raw = await transcriber.transcribe(samples);
          const transcribeMs = performance.now() - started;

          started = performance.now();
          const rulesOnly = await processDictation(raw, { cleanup: false, britishEnglish: true });
          const rulesMs = transcribeMs + (performance.now() - started);

          started = performance.now();
          const withAi = await processDictation(raw, { cleanup: true, britishEnglish: true }, cleaner);
          const aiMs = transcribeMs + (performance.now() - started);

          rows.push({
            id: testCase.id,
            voice,
            accent,
            rate,
            raw,
            speechWer: wordErrorRate(testCase.spoken, raw),
            rules: { ...scoreOne(testCase, rulesOnly.text), text: rulesOnly.text, latencyMs: rulesMs },
            ai: { ...scoreOne(testCase, withAi.text), text: withAi.text, latencyMs: aiMs, usedModel: withAi.usedModel },
          });
          process.stdout.write(".");
        }

        // Voice snippets: does "insert <trigger>" type the right one, and do
        // look-alike sentences ("insert a table...") correctly type nothing?
        for (const command of SNIPPETS.commands) {
          const raw = await transcriber.transcribe(speak(command.spoken, { voice, rate }));
          const matched = matchSnippet(raw, SNIPPETS.snippets);
          snippetRows.push({
            voice,
            rate,
            spoken: command.spoken,
            raw,
            expected: command.expected,
            got: matched ? matched.trigger : null,
          });
        }
      }
      console.log(` ${voice}`);
    }
  } finally {
    transcriber.stop();
    cleaner.stop();
  }

  /** @type {EvalResults} */
  const results = {
    date: new Date().toISOString().slice(0, 10),
    machine: machine(),
    clips: rows.length,
    speechWer: mean(rows.map((r) => r.speechWer)),
    summary: { rules: summarise(rows, "rules"), ai: summarise(rows, "ai") },
    perVoice: VOICES.map(({ voice, accent }) => {
      const mine = rows.filter((r) => r.voice === voice);
      return {
        voice,
        accent,
        speechWer: mean(mine.map((r) => r.speechWer)),
        finalWer: mean(mine.map((r) => r.ai.wer)),
      };
    }),
    snippets: {
      commands: snippetRows.length,
      correct: snippetRows.filter((r) => r.got === r.expected).length / snippetRows.length,
      // Ordinary dictation must never set off a snippet.
      falseFires: rows.filter((r) => matchSnippet(r.raw, SNIPPETS.snippets)).length,
      ordinaryClips: rows.length,
      misses: snippetRows.filter((r) => r.got !== r.expected),
    },
    rows,
  };

  fs.writeFileSync(path.join(__dirname, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const markdown = scorecard(results);
  console.log(`\n${markdown}\n`);
  console.log(updateReadme(markdown) ? "README scorecard updated." : "No eval markers in README; skipped.");
}

main().catch((err) => {
  console.error(`Eval failed: ${err.message}`);
  process.exit(1);
});
