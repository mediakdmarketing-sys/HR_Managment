import { Fragment } from "react";

// Renders the small subset of Markdown the assistant uses (bold, code, bullet and numbered
// lists, headings, tables) as React elements, so no HTML from the model is ever injected.
const inline = (text) =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={index}>{part.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, "$1$2")}</Fragment>;
  });

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

function ChatMarkdown({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
    } else if (trimmed.startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        if (!/^\|?[\s:-]+(\|[\s:-]+)+\|?$/.test(lines[index].trim())) rows.push(cells(lines[index]));
        index += 1;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={blocks.length} className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                {head.map((cell, cellIndex) => (
                  <th key={cellIndex} className="border-b border-slate-200 px-2 py-1.5 font-semibold">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-b border-slate-100 px-2 py-1.5">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^([-*•]|\d+[.)])\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]/.test(trimmed);
      const items = [];
      while (index < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[index])) {
        items.push(lines[index].trim().replace(/^([-*•]|\d+[.)])\s+/, ""));
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={blocks.length} className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item)}</li>
          ))}
        </List>,
      );
    } else if (/^#{1,6}\s/.test(trimmed)) {
      blocks.push(
        <p key={blocks.length} className="font-bold">
          {inline(trimmed.replace(/^#{1,6}\s+/, ""))}
        </p>,
      );
      index += 1;
    } else {
      blocks.push(<p key={blocks.length}>{inline(trimmed)}</p>);
      index += 1;
    }
  }

  return <div className="space-y-2">{blocks}</div>;
}

export default ChatMarkdown;
