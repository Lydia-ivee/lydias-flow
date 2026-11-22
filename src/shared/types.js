// Shared JSDoc types, checked by `npx tsc -p .`. No runtime code lives here.
// Import one with: /** @typedef {import("../shared/types").Snippet} Snippet */

/**
 * A saved voice snippet: say "insert <trigger>" and `text` is typed.
 * @typedef {object} Snippet
 * @property {string} trigger
 * @property {string} text
 */

/**
 * User settings, as stored in settings.json after `withDefaults`.
 * @typedef {object} Settings
 * @property {string} microphoneId "default" follows the Mac's chosen input
 * @property {string} dictateKey one of KEY_CHOICES
 * @property {string} editKey one of KEY_CHOICES, never the same as dictateKey
 * @property {boolean} cleanup tidy text with the local AI model
 * @property {boolean} britishEnglish
 * @property {Snippet[]} snippets
 */

/**
 * Filler word or phrase -> how many times it was said.
 * @typedef {Record<string, number>} FillerCounts
 */

/**
 * What `makeEntry` is given for one dictation.
 * @typedef {object} StatsInput
 * @property {Date} [at] defaults to now
 * @property {number} audioMs
 * @property {number} words
 * @property {FillerCounts} fillers
 * @property {string} mode "dictate", "edit" or "snippet"
 */

/**
 * One line of the Flow Report file: counts only, never the words.
 * @typedef {object} StatsEntry
 * @property {string} at ISO timestamp
 * @property {number} audioMs
 * @property {number} words
 * @property {FillerCounts} fillers
 * @property {string} mode
 */

/**
 * The numbers the Flow Report window shows.
 * @typedef {object} Report
 * @property {number} dictations
 * @property {number} words
 * @property {number} speakingWpm
 * @property {number} typingWpm
 * @property {number} minutesSaved
 * @property {{ word: string, count: number }[]} topFillers
 * @property {{ day: string, words: number }[]} perDay
 */

/**
 * One piece of a dictation split around snippets: either spoken words or a
 * snippet. The other field is typed `undefined` so `if (part.snippet)` narrows.
 * @typedef {{ text: string, snippet?: undefined } | { snippet: Snippet, text?: undefined }} SnippetPart
 */

/**
 * A finished piece of text for `joinParts`. Multiline parts go on their own line.
 * @typedef {object} JoinPart
 * @property {string} text
 * @property {boolean} [multiline]
 */

/**
 * The clean-up model's verdict: its tidied text, or the input if it misbehaved.
 * @typedef {object} CleanupResult
 * @property {string} text
 * @property {boolean} usedModel
 */

/**
 * Anything that can tidy text (the real Cleaner, or a stand-in in tests).
 * @typedef {object} TextCleaner
 * @property {(text: string) => Promise<CleanupResult>} clean
 */

/**
 * @typedef {object} DictationResult
 * @property {string} text
 * @property {FillerCounts} fillers
 * @property {boolean} usedModel
 */

/**
 * A dictation's result plus `snippets`: the triggers of any snippets inserted.
 * @typedef {DictationResult & { snippets: string[] }} SpeechResult
 */

/**
 * A message in OpenAI's chat format, as llama.cpp's server accepts it.
 * @typedef {object} ChatMessage
 * @property {"system" | "user" | "assistant"} role
 * @property {string} content
 */

/**
 * Where the engines and models live.
 * @typedef {object} EngineDirs
 * @property {string} enginesDir
 * @property {string} modelsDir
 */

module.exports = {};
