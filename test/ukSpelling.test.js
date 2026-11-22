const test = require("node:test");
const assert = require("node:assert/strict");
const { toBritish } = require("../src/shared/ukSpelling");

test("converts the real transcript from the speech model", () => {
  // Exactly what Parakeet produced from a test clip on an M2 MacBook.
  const transcript = "Um, so basically I want to organize the color of the center page, you know, before Friday.";
  assert.equal(
    toBritish(transcript),
    "Um, so basically I want to organise the colour of the centre page, you know, before Friday.",
  );
});

test("handles the -ize family and its endings", () => {
  assert.equal(toBritish("realize realized realizing"), "realise realised realising");
  assert.equal(toBritish("the organization organizes organizers"), "the organisation organises organisers");
});

test("handles -yze", () => {
  assert.equal(toBritish("analyze the data, then paralyzed"), "analyse the data, then paralysed");
});

test("leaves words where ize is not a suffix", () => {
  assert.equal(toBritish("size prize seize capsize resize"), "size prize seize capsize resize");
});

test("converts word families with their safe endings only", () => {
  assert.equal(toBritish("colorful favorite honorable"), "colourful favourite honourable");
  // Identical in British English, so they must not change.
  assert.equal(toBritish("humorous honorary laborious"), "humorous honorary laborious");
});

test("keeps the original capitalisation", () => {
  assert.equal(toBritish("Color COLOR color"), "Colour COLOUR colour");
  assert.equal(toBritish("Centered"), "Centred");
});

test("drops the e of -re words before -ed and -ing", () => {
  assert.equal(toBritish("centered centering theaters"), "centred centring theatres");
});

test("leaves ambiguous words alone", () => {
  assert.equal(toBritish("check the program license"), "check the program license");
});

test("does not change text that is already British", () => {
  const british = "The colour of the centre, organised and analysed.";
  assert.equal(toBritish(british), british);
});

test("covers the doubled-L and -se spellings", () => {
  assert.equal(toBritish("We traveled and canceled; good defense."), "We travelled and cancelled; good defence.");
});
