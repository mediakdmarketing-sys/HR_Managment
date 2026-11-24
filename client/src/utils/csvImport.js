const countDelimiters = (line) => {
  let commas = 0;
  let tabs = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && character === ",") {
      commas += 1;
    } else if (!quoted && character === "\t") {
      tabs += 1;
    }
  }
  return tabs > commas ? "\t" : ",";
};

export const parseDelimitedText = (input) => {
  const content = String(input || "").replace(/^\uFEFF/, "");
  const firstLine = content.split(/\r\n|\n|\r/, 1)[0] || "";
  const delimiter = countDelimiters(firstLine);
  const records = [];
  let cells = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let recordLine = 1;

  const finishCell = () => {
    cells.push(value.trim());
    value = "";
    closedQuote = false;
  };
  const finishRecord = () => {
    finishCell();
    if (cells.some((cell) => cell !== "")) records.push({ cells, line: recordLine });
    cells = [];
    recordLine = line + 1;
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else if (character === "\r" || character === "\n") {
        value += "\n";
        if (character === "\r" && next === "\n") index += 1;
        line += 1;
      } else {
        value += character;
      }
      continue;
    }
    if (closedQuote) {
      if (character === " " || (character === "\t" && delimiter !== "\t")) continue;
      if (character !== delimiter && character !== "\r" && character !== "\n") {
        throw new Error(`Unexpected character after a quoted field on line ${line}.`);
      }
    }
    if (character === '"') {
      if (value.trim()) throw new Error(`Unexpected quote on line ${line}.`);
      value = "";
      quoted = true;
    } else if (character === delimiter) {
      finishCell();
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && next === "\n") index += 1;
      line += 1;
      recordLine = line;
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("The CSV content contains an unclosed quoted field.");
  if (value !== "" || cells.length || closedQuote) finishRecord();
  return { delimiter, records };
};

export const serializeCsv = (headers, rows) => {
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
};

export const normalizeCsvHeader = (value) =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
