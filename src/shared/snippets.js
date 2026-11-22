// Voice snippets: say "insert my sign-off" and your saved text is typed,
// on its own or in the middle of a sentence:
//
//   "Thanks for your time today, insert my sign-off"
//     -> "Thanks for your time today." + your sign-off
//
// No AI decides whether you meant a snippet. The rules are:
//   1. A command word ("insert" or "snippet") anywhere in what you said...
//   2. ...directly followed by words that closely match one of your triggers.
// Close, not exact, because speech recognition mishears a little ("my sign
// of" for "my sign-off"). If the words after "insert" match no trigger
// ("insert a table here"), nothing happens and your words are typed as said.

const COMMAND_WORDS = ["insert", "snippet"];
const NOISE = new Set(["um", "umm", "uh", "uhh", "er", "erm", "hmm"]);
const MIN_SIMILARITY = 0.75;

// Lowercase words only, no punctuation, hyphens or noise: "Insert my sign-off."
// and "um insert my sign off" both become "insert my sign off".
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !NOISE.has(word))
    .join(" ");
}

// Letter-level edit distance (the fewest letter changes between two strings).
function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), previous[j] + 1, current[j - 1] + 1);
    }
    previous = current;
  }
  return previous[b.length];
}

// 1 means identical, 0 means nothing in common.
function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - editDistance(a, b) / longest;
}

// Each word of the transcript with where it sits, so a snippet can be cut out
// of the original text exactly. "sign-off" and "today's" count as one word.
function tokenise(transcript) {
  return [...transcript.matchAll(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
    normalised: normalise(m[0]), // "" for noise words like "um"
  }));
}

// After the command word at `at`, try the next 1, 2, 3... words against every
// trigger and keep the closest match. Returns { snippet, lastToken } or null.
function bestTriggerAfter(tokens, at, triggers) {
  const longest = Math.max(...triggers.map((t) => t.words));
  let best = null;
  let spoken = [];
  for (let j = at + 1; j < tokens.length && spoken.length < longest + 1; j += 1) {
    if (!tokens[j].normalised) continue; // skip "um"
    spoken = [...spoken, tokens[j].normalised];
    const said = spoken.join(" ");
    for (const trigger of triggers) {
      const score = similarity(said, trigger.normalised);
      if (score >= MIN_SIMILARITY && (!best || score > best.score))
        best = { snippet: trigger.snippet, lastToken: j, score };
    }
  }
  return best;
}

// Splits what you said into spoken parts and snippets, in order:
//   [{ text: "Thanks for your time today" }, { snippet: {...} }]
function splitOnSnippets(transcript, snippets) {
  const triggers = snippets
    .map((snippet) => ({ snippet, normalised: normalise(snippet.trigger) }))
    .filter((t) => t.normalised)
    .map((t) => ({ ...t, words: t.normalised.split(" ").length }));
  if (triggers.length === 0) return [{ text: transcript }];

  const tokens = tokenise(transcript);
  const parts = [];
  let cursor = 0; // where the next spoken part starts in the original text
  for (let i = 0; i < tokens.length; i += 1) {
    if (!COMMAND_WORDS.includes(tokens[i].normalised)) continue;
    const found = bestTriggerAfter(tokens, i, triggers);
    if (!found) continue;

    // The spoken part before, without the comma that led into "insert".
    const before = transcript.slice(cursor, tokens[i].start).replace(/[\s,;:]+$/, "");
    if (before.trim()) parts.push({ text: before.trim() });
    parts.push({ snippet: found.snippet });

    // Resume after the trigger and any punctuation straight after it.
    const afterTrigger = transcript.slice(tokens[found.lastToken].end).match(/^[\s.,;:!?]*/)[0];
    cursor = tokens[found.lastToken].end + afterTrigger.length;
    i = found.lastToken;
  }
  const rest = transcript.slice(cursor).trim();
  if (rest) parts.push({ text: rest });
  return parts;
}

// The first snippet in what you said, or null if it was ordinary dictation.
function matchSnippet(transcript, snippets) {
  const part = splitOnSnippets(transcript, snippets).find((p) => p.snippet);
  return part ? part.snippet : null;
}

// Puts finished parts back together. A snippet with line breaks (a sign-off,
// an address) goes on its own line; a one-line snippet sits in the sentence.
function joinParts(parts) {
  let out = "";
  let previousMultiline = false;
  for (const { text, multiline } of parts) {
    if (!text) continue;
    if (out) out += multiline || previousMultiline ? "\n" : " ";
    out += text;
    previousMultiline = Boolean(multiline);
  }
  return out;
}

// Fills in {date}, {time} and {clipboard}. Anything else in braces is left alone.
function expandPlaceholders(text, { now = new Date(), clipboard = "" } = {}) {
  // Built from parts, because the system format adds a comma ("Monday, 23 November").
  const part = (options) => now.toLocaleDateString("en-GB", options);
  const values = {
    date: `${part({ weekday: "long" })} ${part({ day: "numeric" })} ${part({ month: "long" })} ${part({ year: "numeric" })}`,
    time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    clipboard,
  };
  return text.replace(/\{(date|time|clipboard)\}/g, (_, name) => values[name]);
}

// Keeps only well-formed snippets, so a damaged settings file can't break dictation.
function cleanSnippets(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && typeof s.trigger === "string" && typeof s.text === "string")
    .map((s) => ({ trigger: s.trigger.trim().slice(0, 60), text: s.text.slice(0, 5000) }))
    .filter((s) => normalise(s.trigger) && s.text)
    .slice(0, 100);
}

module.exports = {
  COMMAND_WORDS,
  normalise,
  similarity,
  splitOnSnippets,
  matchSnippet,
  joinParts,
  expandPlaceholders,
  cleanSnippets,
};
