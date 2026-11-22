// The recipe that turns a raw transcript into the text that gets typed.
//
//   1. remove pure noise words (rules: always safe, no AI)
//   2. tidy grammar and punctuation (local AI model, if clean-up is on)
//   3. British spelling (rules, if on). Last, because the model could put
//      American spellings back.
//
// Filler counts for the Flow Report come from the raw transcript, before
// anything is removed, and only the counts leave this function.

const { removeFillers, countFillers } = require("../shared/fillers");
const { toBritish } = require("../shared/ukSpelling");
const { splitOnSnippets, joinParts, expandPlaceholders } = require("../shared/snippets");

/** @typedef {import("../shared/types").Settings} Settings */
/** @typedef {import("../shared/types").TextCleaner} TextCleaner */
/** @typedef {import("../shared/types").DictationResult} DictationResult */
/** @typedef {import("../shared/types").SpeechResult} SpeechResult */
/** @typedef {import("../shared/types").JoinPart} JoinPart */

/**
 * @param {string} rawTranscript
 * @param {Pick<Settings, "cleanup" | "britishEnglish">} settings
 * @param {TextCleaner} [cleaner] left out when clean-up is off
 * @returns {Promise<DictationResult>}
 */
async function processDictation(rawTranscript, { cleanup, britishEnglish }, cleaner) {
  const fillers = countFillers(rawTranscript);
  let text = removeFillers(rawTranscript);
  let usedModel = false;

  if (cleanup && cleaner && text) {
    try {
      const result = await cleaner.clean(text);
      text = result.text;
      usedModel = result.usedModel;
    } catch {
      // If the model is down or slow, still type the rule-cleaned words.
    }
  }

  if (britishEnglish) text = toBritish(text);
  return { text, fillers, usedModel };
}

// The full dictate step, snippets included. What you said is split around any
// snippets: spoken parts go through processDictation, snippets are typed
// exactly as saved, and everything is joined back together in order.
/**
 * @param {string} rawTranscript
 * @param {Settings} settings
 * @param {TextCleaner} [cleaner]
 * @param {{ clipboard?: string, now?: Date }} [options]
 * @returns {Promise<SpeechResult>}
 */
async function processSpeech(rawTranscript, settings, cleaner, { clipboard = "", now = new Date() } = {}) {
  const parts = splitOnSnippets(rawTranscript, settings.snippets || []);
  if (!parts.some((part) => part.snippet)) {
    return { ...(await processDictation(rawTranscript, settings, cleaner)), snippets: [] };
  }

  /** @type {JoinPart[]} */
  const finished = [];
  let usedModel = false;
  for (const part of parts) {
    if (part.snippet) {
      const text = expandPlaceholders(part.snippet.text, { clipboard, now });
      finished.push({ text, multiline: text.includes("\n") });
    } else {
      const result = await processDictation(part.text, settings, cleaner);
      let text = result.text;
      // Tidying treats each part as a new sentence and capitalises it. If the
      // part actually continues a sentence ("...1 Example Street by Friday"),
      // put back the first letter's case as spoken, so "by" stays lowercase
      // but "London" stays capitalised.
      const previous = finished.at(-1)?.text || "";
      if (previous && !/[.!?\n]$/.test(previous) && /^[a-z]/.test(part.text)) {
        text = text.charAt(0).toLowerCase() + text.slice(1);
      }
      finished.push({ text });
      usedModel = usedModel || result.usedModel;
    }
  }
  return {
    text: joinParts(finished),
    fillers: countFillers(rawTranscript),
    usedModel,
    // `!== undefined` (not plain truthiness) lets TypeScript narrow the filtered parts to snippets.
    snippets: parts.filter((part) => part.snippet !== undefined).map((part) => part.snippet.trigger),
  };
}

module.exports = { processDictation, processSpeech };
