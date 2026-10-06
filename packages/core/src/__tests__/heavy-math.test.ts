/*
  Heavy babel-v3 tests against the real library constants.

  Run: npm run test:heavy
  Prefers numbers.hex.json (fast). Generate with:
    node scripts/convert-numbers-to-hex.mjs
*/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BOOK_LENGTH } from "../constants";
import {
  assertInverseIdentity,
  generateContent,
  lookupContent,
} from "../generation/content";
import {
  loadNumbersFromHexJson,
  loadNumbersFromString,
} from "../mathematics/numbers";
import { buildEmptyBookContent, buildSpacePaddedBook } from "../search/build";

const here = path.dirname(fileURLToPath(import.meta.url));
const hexPath = path.resolve(here, "../../data/numbers.hex.json");
const numbersPath = path.resolve(here, "../../data/numbers");

describe("heavy library math (babel-v3 numbers)", () => {
  beforeAll(() => {
    if (fs.existsSync(hexPath)) {
      loadNumbersFromHexJson(fs.readFileSync(hexPath, "utf8"));
      return;
    }
    loadNumbersFromString(fs.readFileSync(numbersPath, "utf8"));
  }, 600_000);

  it("satisfies C·I ≡ 1 (mod N)", () => {
    assertInverseIdentity();
  });

  it("round-trips emptybook search for a short sentence", () => {
    const text = "the moon hung over the empty warehouse";
    const book = buildEmptyBookContent(text);
    expect(book).toHaveLength(BOOK_LENGTH);
    const identifier = lookupContent(book, 1);
    const regenerated = generateContent(identifier, true);
    expect(regenerated.content).toBe(book);
  }, 600_000);

  it("space-padded discovery is stable across lookups", () => {
    const { book, page } = buildSpacePaddedBook("tony", 1);
    const id1 = lookupContent(book, page);
    const id2 = lookupContent(book, page);
    expect(id1).toBe(id2);
    const pageContent = generateContent(id1, false);
    expect(pageContent.content.startsWith("tony")).toBe(true);
  }, 600_000);

  it("page 1 of book 1.1.1.1 has PAGE_LENGTH characters", () => {
    const page = generateContent("1.1.1.1.1", false);
    expect(page.content).toHaveLength(3200);
    expect(page.page).toBe("1");
    expect(page.nextIdentifier.endsWith(".2")).toBe(true);
  }, 600_000);
});
