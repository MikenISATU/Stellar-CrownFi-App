import assert from "node:assert/strict";
import { countryCodeFor, countryCodeFromOutcomeLabel } from "./countries";
import { MAX_MARKET_OPTIONS, parseOutcomeList } from "./marketOptions";

const candidates = parseOutcomeList([
  "Country,Name",
  'Albania,"Alba, Jr."',
  "China PR,Dong Yifei",
  "Bosnia & Herzegovina,Lana Jahić",
  "England,Delegate",
].join("\n"));

assert.deepEqual(candidates, [
  { label: "Alba, Jr.", country: "Albania", flagCode: "AL" },
  { label: "Dong Yifei", country: "China PR", flagCode: "CN" },
  { label: "Lana Jahić", country: "Bosnia & Herzegovina", flagCode: "BA" },
  { label: "Delegate", country: "England", flagCode: "GB-ENG" },
]);

assert.equal(countryCodeFor("Cote d'Ivoire"), "CI");
assert.equal(countryCodeFor("Curaçao"), "CW");
assert.equal(countryCodeFor("Türkiye"), "TR");
assert.equal(countryCodeFor("Myanmar"), "MM");
assert.equal(countryCodeFromOutcomeLabel("Philippines — Candidate Name"), "PH");
assert.equal(countryCodeFromOutcomeLabel("Indonesia"), "ID");

const oversized = parseOutcomeList([
  "Name,Country",
  ...Array.from({ length: MAX_MARKET_OPTIONS + 20 }, (_, index) => `Candidate ${index + 1},Philippines`),
].join("\n"));
assert.equal(oversized.length, MAX_MARKET_OPTIONS);

console.log("market option CSV tests passed");
