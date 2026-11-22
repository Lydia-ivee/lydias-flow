// Filler words, handled two ways:
//
// 1. removeFillers: deletes pure noise (um, uh, er, erm, hmm) with rules.
//    These sounds never carry meaning, so removing them is always safe and
//    does not need the AI model. Words like "basically" or "like" can carry
//    meaning, so they are left for the model to judge.
//
// 2. countFillers: counts a wider set, including "you know" and "basically",
//    for the Flow Report. It returns numbers only, never the text.

const NOISE = ["um", "umm", "uh", "uhh", "er", "erm", "hmm", "mm"];

// A noise word, any commas or full stop straight after it, and the space before it.
const NOISE_PATTERN = new RegExp(`(^|\\s)(?:${NOISE.join("|")})\\b[,.]?`, "gi");

function removeFillers(text) {
  const cleaned = text
    .replace(NOISE_PATTERN, "$1")
    .replace(/\s{2,}/g, " ") // collapse the gaps left behind
    .replace(/\s+([,.!?])/g, "$1") // no space before punctuation
    .replace(/^[\s,]+/, "") // no leading comma
    .trim()
    // Removing "Um," at the start of a sentence can leave its first letter lowercase.
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, before, letter) => before + letter.toUpperCase());
  return cleaned;
}

// Fillers tracked in the Flow Report. Phrases come before single words so
// "you know" is counted as one filler.
const TRACKED = [
  "you know", "i mean", "sort of", "kind of",
  "um", "uh", "er", "erm", "hmm", "like", "basically", "literally", "actually", "so yeah",
];

function countFillers(text) {
  let remaining = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, " ")} `;
  const counts = {};
  for (const filler of TRACKED) {
    const pattern = new RegExp(` ${filler} `, "g");
    let found = 0;
    // Replace each match with a single space so overlapping words still match.
    remaining = remaining.replace(pattern, () => {
      found += 1;
      return "  ";
    });
    if (found > 0) counts[filler] = found;
  }
  return counts;
}

module.exports = { removeFillers, countFillers };
