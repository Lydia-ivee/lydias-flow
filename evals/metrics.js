// Scoring for the eval suite. Pure functions, unit-tested in test/evalMetrics.test.js.

// Words for comparison: lowercase, curly apostrophes made straight, punctuation
// dropped. "Friday." and "friday" count as the same word.
/**
 * @param {string} text
 * @returns {string[]}
 */
function words(text) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .replace(/(^|\s)'|'(\s|$)/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}

// Word error rate: the fewest substitutions, insertions and deletions needed to
// turn `hypothesis` into `reference`, divided by the reference length. This is
// the standard accuracy measure for speech recognition. 0 is perfect.
/**
 * @param {string} reference
 * @param {string} hypothesis
 * @returns {number}
 */
function wordErrorRate(reference, hypothesis) {
  const ref = words(reference);
  const hyp = words(hypothesis);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;

  // Classic edit-distance table, kept to two rows to save memory.
  let previous = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= hyp.length; j += 1) {
      const substitution = previous[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1);
    }
    previous = current;
  }
  return previous[hyp.length] / ref.length;
}

// How often each filler appears, matching whole words and phrases only.
/**
 * @param {string} text
 * @param {string[]} phrases
 * @returns {number}
 */
function countPhrases(text, phrases) {
  const padded = ` ${words(text).join(" ")} `;
  return phrases.reduce((total, phrase) => {
    const matches = padded.match(new RegExp(` ${phrase} `, "g"));
    return total + (matches ? matches.length : 0);
  }, 0);
}

/**
 * @param {number[]} values
 * @param {number} p 0 to 100
 * @returns {number}
 */
function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

/** @param {number[]} values */
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

module.exports = { words, wordErrorRate, countPhrases, percentile, mean };
