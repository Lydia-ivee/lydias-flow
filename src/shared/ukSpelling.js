// British English mode: turns American spellings into British ones.
//
// Speech models are trained mostly on American text, so they write "color" and
// "organize". This runs after transcription and fixes that, without any AI:
// it is a word list plus two spelling rules, so it is fast, predictable and
// easy to test.
//
// Design rule: when the British spelling depends on meaning, leave the word
// alone. "program" (software) vs "programme" (TV), "check" vs "cheque",
// "license" (verb) vs "licence" (noun). A missed change is better than a
// wrong one.

// Word families: American stem -> British stem, plus the endings that are safe
// to carry over. "color" covers color, colors, colored, coloring, colorful...
// Endings are listed on purpose, so "humorous" and "honorary" (identical in
// British English) are never touched.
const OUR_ENDINGS = ["", "s", "ed", "ing", "ful", "fully", "less", "ite", "ites", "able", "ably", "er", "ers"];

const FAMILIES = [
  // -or -> -our
  ...[
    "color", "favor", "honor", "labor", "neighbor", "behavior", "flavor",
    "harbor", "humor", "rumor", "vapor", "vigor", "rigor", "armor",
    "endeavor", "odor", "valor", "tumor", "parlor", "clamor", "candor",
    "fervor", "savor", "splendor",
  ].map((us) => [us, us.replace(/or$/, "our"), OUR_ENDINGS]),

  // -er -> -re. British drops the final e before -ed and -ing:
  // centered -> centred, centering -> centring (not "centreed").
  ...[
    "center", "theater", "fiber", "liter", "kilometer", "centimeter",
    "millimeter", "somber", "specter", "saber", "luster", "meager", "caliber",
  ].flatMap((us) => {
    const uk = us.replace(/er$/, "re");
    const ukWithoutE = uk.slice(0, -1);
    return [
      [us, uk, ["", "s"]],
      [us + "ed", ukWithoutE + "ed", [""]],
      [us + "ing", ukWithoutE + "ing", [""]],
    ];
  }),

  // Doubled L before an ending
  ["traveled", "travelled", [""]],
  ["traveling", "travelling", [""]],
  ["traveler", "traveller", ["", "s"]],
  ["canceled", "cancelled", [""]],
  ["canceling", "cancelling", [""]],
  ["labeled", "labelled", [""]],
  ["labeling", "labelling", [""]],
  ["modeled", "modelled", [""]],
  ["modeling", "modelling", [""]],
  ["fueled", "fuelled", [""]],
  ["fueling", "fuelling", [""]],
  ["signaled", "signalled", [""]],
  ["signaling", "signalling", [""]],
  ["jeweler", "jeweller", ["", "s"]],
  ["jewelry", "jewellery", [""]],

  // Single L where American English doubles it
  ["fulfill", "fulfil", ["", "s"]],
  ["enroll", "enrol", ["", "s"]],
  ["enrollment", "enrolment", ["", "s"]],
  ["installment", "instalment", ["", "s"]],
  ["skillful", "skilful", ["", "ly"]],
  ["willful", "wilful", ["", "ly"]],

  // -se nouns
  ["defense", "defence", ["", "s", "less"]],
  ["offense", "offence", ["", "s"]],
  ["pretense", "pretence", ["", "s"]],

  // Everything else
  ["gray", "grey", ["", "s", "er", "est", "ish"]],
  ["catalog", "catalogue", ["", "s"]],
  ["aluminum", "aluminium", [""]],
  ["airplane", "aeroplane", ["", "s"]],
  ["pajamas", "pyjamas", [""]],
  ["plow", "plough", ["", "s", "ed", "ing"]],
  ["mold", "mould", ["", "s", "y"]],
  ["cozy", "cosy", [""]],
  ["donut", "doughnut", ["", "s"]],
  ["aging", "ageing", [""]],
  ["maneuver", "manoeuvre", ["", "s"]],
  ["mom", "mum", ["", "s"]],
];

// Words ending in -ize where "ize" is not a suffix you can swap.
const IZE_EXCEPTIONS = new Set(["size", "prize", "seize", "capsize", "maize", "baize", "downsize", "oversize", "resize"]);

function buildWordMap() {
  const map = new Map();
  for (const [us, uk, endings] of FAMILIES) {
    for (const ending of endings) {
      map.set(us + ending, uk + ending);
    }
  }
  return map;
}

const WORD_MAP = buildWordMap();

// -ize family: organize, organizes, organized, organizing, organization(s), organizer(s).
// -yze family: analyze, analyzed, analyzing, paralyze...
const IZE = /^(\w+?)iz(e|es|ed|ing|ation|ations|er|ers)$/;
const YZE = /^(\w+?)yz(e|es|ed|ing|er|ers)$/;

function convertLowercaseWord(word) {
  if (WORD_MAP.has(word)) return WORD_MAP.get(word);

  const ize = word.match(IZE);
  if (ize) {
    const baseWord = ize[1] + "ize";
    if (!IZE_EXCEPTIONS.has(baseWord) && ize[1].length >= 3) {
      return ize[1] + "is" + ize[2];
    }
  }

  const yze = word.match(YZE);
  if (yze && yze[1].length >= 3) return yze[1] + "ys" + yze[2];

  return word;
}

// Keep the original capitalisation: color -> colour, Color -> Colour, COLOR -> COLOUR.
function matchCase(original, replacement) {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function toBritish(text) {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const converted = convertLowercaseWord(word.toLowerCase());
    return converted === word.toLowerCase() ? word : matchCase(word, converted);
  });
}

module.exports = { toBritish };
