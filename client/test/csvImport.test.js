import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDelimitedText, serializeCsv } from "../src/utils/csvImport.js";

test("parses quoted CSV commas, doubled quotes, embedded line breaks, and CRLF", () => {
  const parsed = parseDelimitedText(
    'name,notes\r\n"Doe, Jane","Said ""hello""\r\nagain"\r\n',
  );
  assert.deepEqual(parsed.records.map((record) => record.cells), [
    ["name", "notes"],
    ["Doe, Jane", 'Said "hello"\nagain'],
  ]);
});

test("accepts tab-separated spreadsheet paste and serializes it as quoted CSV", () => {
  const parsed = parseDelimitedText('name\temail\n"Doe, Jane"\tjane@example.test');
  assert.equal(parsed.delimiter, "\t");
  assert.deepEqual(parsed.records[1].cells, ["Doe, Jane", "jane@example.test"]);
  assert.equal(
    serializeCsv(["name", "email"], [["Doe, Jane", "jane@example.test"]]),
    'name,email\r\n"Doe, Jane",jane@example.test',
  );
});

test("rejects malformed quoted input", () => {
  assert.throws(() => parseDelimitedText('name,notes\nJane,"unfinished'), /unclosed quoted field/);
  assert.throws(() => parseDelimitedText('name,notes\n"Jane"x,test'), /after a quoted field/);
});
