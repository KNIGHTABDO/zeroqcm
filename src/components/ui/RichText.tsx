"use client";
import React from "react";

interface RichTextProps {
  text: string;
  className?: string;
}

// ── Inline renderer ────────────────────────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, ^sup, _sub
function renderInline(text: string, baseKey: string): React.ReactNode {
  if (!text) return null;

  const result: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  let buf = "";

  const flush = () => {
    if (buf) { result.push(<React.Fragment key={`${baseKey}-t${keyIdx++}`}>{buf}</React.Fragment>); buf = ""; }
  };

  while (i < text.length) {
    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        flush();
        result.push(<strong key={`${baseKey}-b${keyIdx++}`} className="font-semibold" style={{ color: "var(--text)" }}>{text.slice(i + 2, end)}</strong>);
        i = end + 2; continue;
      }
    }
    // *italic*
    if (text[i] === "*" && text[i + 1] !== "*") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1) {
        flush();
        result.push(<em key={`${baseKey}-em${keyIdx++}`}>{text.slice(i + 1, end)}</em>);
        i = end + 1; continue;
      }
    }
    // `code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        flush();
        result.push(
          <code key={`${baseKey}-c${keyIdx++}`}
            className="px-1 py-0.5 rounded text-[0.8em] font-mono"
            style={{ background: "var(--surface-active)", color: "var(--accent)" }}>
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1; continue;
      }
    }
    // ^superscript (e.g. ^2)
    if (text[i] === "^") {
      let j = i + 1;
      while (j < text.length && text[j] !== " " && text[j] !== "^") j++;
      if (j > i + 1) {
        flush();
        result.push(<sup key={`${baseKey}-sup${keyIdx++}`} className="text-[0.7em]">{text.slice(i + 1, j)}</sup>);
        i = j; continue;
      }
    }
    // _subscript_ (only when surrounded by non-space)
    if (text[i] === "_" && i > 0 && text[i - 1] !== " ") {
      const end = text.indexOf("_", i + 1);
      if (end !== -1 && end < i + 20) {
        flush();
        result.push(<sub key={`${baseKey}-sub${keyIdx++}`} className="text-[0.7em]">{text.slice(i + 1, end)}</sub>);
        i = end + 1; continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return result.length === 1 ? result[0] : <>{result}</>;
}

// ── Table parser ────────────────────────────────────────────────────────────────
function parseTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  const tableLines = lines.filter(l => l.trim().startsWith("|"));
  if (tableLines.length < 2) return null;

  const parseCells = (line: string): string[] =>
    line.split("|").map(c => c.trim()).filter((_, idx, a) => idx > 0 && idx < a.length - 1);

  const headers = parseCells(tableLines[0]);
  // Skip separator line (---)
  const dataLines = tableLines.slice(1).filter(l => {
    const stripped = l.replace(/[|\-\s]/g, "");
    return stripped.length > 0;
  });
  const rows = dataLines.map(parseCells);
  return headers.length > 0 ? { headers, rows } : null;
}

// ── Main component ──────────────────────────────────────────────────────────────
export function RichText({ text, className = "" }: RichTextProps) {
  if (!text) return null;

  // Split into double-newline blocks, preserving table blocks
  const rawBlocks = text.split("\n\n");
  const elements: React.ReactNode[] = [];

  rawBlocks.forEach((block, blockIdx) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const lines = trimmed.split("\n").map(l => l.trim());

    // ── Table block
    const hasTable = lines.some(l => l.startsWith("|"));
    if (hasTable && lines.length >= 2) {
      const table = parseTable(lines);
      if (table) {
        elements.push(
          <div key={`block-${blockIdx}`} className="overflow-x-auto my-2 rounded-xl" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-active)" }}>
                  {table.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                      style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                      {renderInline(h, `th-${blockIdx}-${i}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2"
                        style={{ color: "var(--text)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        {renderInline(cell, `td-${blockIdx}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        return;
      }
    }

    // ── Bullet list (- item or • item)
    const isBulletList = lines.length > 1 && lines.every(l => l.startsWith("- ") || l.startsWith("* ") || l.startsWith("• "));
    if (isBulletList) {
      elements.push(
        <ul key={`block-${blockIdx}`} className="list-none space-y-1 my-1">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
              <span style={{ color: "var(--text)" }}>{renderInline(l.slice(2), `bullet-${blockIdx}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
      return;
    }

    // ── Numbered list (1. item or 1) item)
    const isNumList = lines.length > 1 && lines.every(l => {
      const first = l.split(" ")[0];
      return first.endsWith(".") || first.endsWith(")");
    });
    if (isNumList) {
      elements.push(
        <ol key={`block-${blockIdx}`} className="list-none space-y-1 my-1">
          {lines.map((l, i) => {
            const spaceIdx = l.indexOf(" ");
            const content = spaceIdx > -1 ? l.slice(spaceIdx + 1) : l;
            return (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 w-4 text-right" style={{ color: "var(--accent)" }}>{i + 1}.</span>
                <span style={{ color: "var(--text)" }}>{renderInline(content, `num-${blockIdx}-${i}`)}</span>
              </li>
            );
          })}
        </ol>
      );
      return;
    }

    // ── Plain paragraph — handle single newlines as <br>
    elements.push(
      <p key={`block-${blockIdx}`} className={`text-sm leading-relaxed ${className}`} style={{ color: "var(--text)" }}>
        {lines.map((line, li) => (
          <React.Fragment key={li}>
            {renderInline(line, `para-${blockIdx}-${li}`)}
            {li < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
}
