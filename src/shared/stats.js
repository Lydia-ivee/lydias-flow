// The Flow Report: numbers about how you dictate.
//
// Each dictation adds one line to a local file with counts only: how long you
// spoke, how many words, which filler words. Never the words themselves, so
// the report cannot leak what you said.

/** @typedef {import("./types").StatsInput} StatsInput */
/** @typedef {import("./types").StatsEntry} StatsEntry */
/** @typedef {import("./types").Report} Report */
/** @typedef {import("./types").FillerCounts} FillerCounts */

const TYPING_WPM = 40; // a typical typing speed, used for "time saved"

/**
 * @param {StatsInput} input
 * @returns {StatsEntry}
 */
function makeEntry({ at = new Date(), audioMs, words, fillers, mode }) {
  return { at: at.toISOString(), audioMs: Math.round(audioMs), words, fillers, mode };
}

/**
 * @param {string} text
 * @returns {number}
 */
function wordCount(text) {
  return (text.match(/[\p{L}\p{N}'’]+/gu) || []).length;
}

/**
 * @param {Date} date
 * @returns {string}
 */
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

// Turns stored entries into the numbers the report shows.
/**
 * @param {StatsEntry[]} entries
 * @param {{ now?: Date, days?: number }} [options]
 * @returns {Report}
 */
function summarise(entries, { now = new Date(), days = 7 } = {}) {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);
  const recent = entries.filter((e) => new Date(e.at) >= since);

  const words = recent.reduce((sum, e) => sum + e.words, 0);
  const speakingMinutes = recent.reduce((sum, e) => sum + e.audioMs, 0) / 60000;
  const typingMinutes = words / TYPING_WPM;

  /** @type {FillerCounts} */
  const fillerTotals = {};
  for (const entry of recent) {
    for (const [filler, count] of Object.entries(entry.fillers || {})) {
      fillerTotals[filler] = (fillerTotals[filler] || 0) + count;
    }
  }
  const topFillers = Object.entries(fillerTotals)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  const perDay = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + i);
    const key = dayKey(day);
    const dayWords = recent.filter((e) => e.at.startsWith(key)).reduce((sum, e) => sum + e.words, 0);
    perDay.push({ day: key, words: dayWords });
  }

  return {
    dictations: recent.length,
    words,
    speakingWpm: speakingMinutes > 0 ? Math.round(words / speakingMinutes) : 0,
    typingWpm: TYPING_WPM,
    minutesSaved: Math.max(0, Math.round((typingMinutes - speakingMinutes) * 10) / 10),
    topFillers,
    perDay,
  };
}

// The file is JSON Lines: one entry per line, so adding one is a cheap append
// and a damaged line only loses that one entry.
/**
 * @param {string} text
 * @returns {StatsEntry[]}
 */
function parseLines(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

module.exports = { makeEntry, wordCount, summarise, parseLines, TYPING_WPM };
