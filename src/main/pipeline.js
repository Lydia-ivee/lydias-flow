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

module.exports = { processDictation };
