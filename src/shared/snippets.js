// Voice snippets: say "insert my sign-off" and your saved text is typed.
//
// No AI decides whether you meant a snippet. The rules are:
//   1. What you said must start with a command word ("insert" or "snippet").
//   2. Everything after it must closely match one of your trigger phrases.
// Close, not exact, because speech recognition mishears a little ("my sign
// of" for "my sign-off"). Rule 1 means ordinary dictation can't set one off.

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

// Returns the snippet you meant, or null if this was ordinary dictation.
function matchSnippet(transcript, snippets) {
  const words = normalise(transcript).split(" ");
  if (!COMMAND_WORDS.includes(words[0])) return null;
  const spokenTrigger = words.slice(1).join(" ");
  if (!spokenTrigger) return null;

  let best = null;
  for (const snippet of snippets) {
    const score = similarity(spokenTrigger, normalise(snippet.trigger));
    if (score >= MIN_SIMILARITY && (!best || score > best.score)) best = { snippet, score };
  }
  return best ? best.snippet : null;
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

module.exports = { COMMAND_WORDS, normalise, similarity, matchSnippet, expandPlaceholders, cleanSnippets };
