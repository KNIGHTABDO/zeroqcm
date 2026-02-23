"use client";
import React from "react";
/**
 * RichText — renders question/answer text with full markdown support.
 *
 * Handles: tables (|…|), bold (**…**), italic, code (`…`), lists,
 * line breaks, and superscript/subscript patterns common in medical QCMs.
 */

interface RichTextProps {
  text: string;
  className?: string;
}

// Parse a pipe-table string → { headers, rows }
function parseTable(raw: string): { headers: string[]; rows: string[][] } | null {
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const tableLines = lines.filter(l => l.startsWith("|"));
  if (tableLines.length < 2) return null;

  const parseCells = (line: string) =>
    line.split("|").map(c => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);

  const headers = parseCells(tableLines[0]);
  const rows = tableLines
    .slice(1)
    .filter(l => !/^[|\s-]+$/.test(l))
    .map(parseCells);

  return headers.length > 0 ? { headers, rows } : null;
}

// Inline markdown: **bold**, *italic*, `code`, sub/superscript
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Process all inline patterns
  let remaining = text;
  let key = 0;

  const patterns: [RegExp, (m: RegExpMatchArray) => React.ReactNode][] = [
    [/\*\*(.+?)\*\*/s,  (m) => <strong key={key++} className="font-semibold" style={{ color: "var(--text)" }}>{m[1]}</strong>],
    [/\*(.+?)\*/s,       (m) => <em key={key++} style={{ color: "var(--text)" }}>{m[1]}</em>],
    [/`([^`]+)`/,          (m) => <code key={key++} className="px-1 py-0.5 rounded text-[0.8em] font-mono" style={{ background: "var(--surface-active)", color: "var(--accent)" }}>{m[1]}</code>],
    [/\^([^\s^]+)/,       (m) => <sup key={key++} className="text-[0.7em]">{m[1]}</sup>],
    [/_([^_]+)_/,          (m) => <sub key={key++} className="text-[0.7em]">{m[1]}</sub>],
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; node: React.ReactNode } | null = null;

    for (const [re, fn] of patterns) {
      const m = remaining.match(re);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.index) {
          earliest = { index: m.index, match: m, node: fn(m) };
        }
      }
    }

    if (!earliest) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (earliest.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, earliest.index)}</span>);
    }
    parts.push(earliest.node);
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }

  return parts;
}

export function RichText({ text, className = "" }: RichTextProps) {
  if (!text) return null;

  // Split text into blocks (separated by double newline or table blocks)
  const blocks = text.split("\n\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Detect markdown table
    if (trimmed.includes("|") && trimmed.split("\n").filter(l => l.trim().startsWith("|")).length >= 2) {
      const table = parseTable(trimmed);
      if (table) {
        elements.push(
          <div key={key++} className="overflow-x-auto my-2 rounded-xl" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ background: "var(--surface-active)" }}>
                  {table.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold" style={{ color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "var(--surface-alt)" }}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2" style={{ color: "var(--text)", borderTop: "1px solid var(--border-subtle)" }}>
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // Bullet/unordered list
    const listLines = trimmed.split("\n");
    const isList = listLines.every(l => /^[\-\*•]\s/.test(l.trim()));
    if (isList && listLines.length > 1) {
      elements.push(
        <ul key={key++} className="list-none space-y-1 my-1">
          {listLines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
              <span style={{ color: "var(--text)" }}>{renderInline(l.replace(/^[\-\*•]\s/, ""))}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    const numLines = trimmed.split("\n");
    const isNumList = numLines.every(l => /^\d+[.)\s]/.test(l.trim()));
    if (isNumList && numLines.length > 1) {
      elements.push(
        <ol key={key++} className="list-none space-y-1 my-1">
          {numLines.map((l, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span className="text-[10px] font-bold mt-0.5 flex-shrink-0 w-4 text-right" style={{ color: "var(--accent)" }}>{i + 1}.</span>
              <span style={{ color: "var(--text)" }}>{renderInline(l.replace(/^\d+[.)\s]+/, ""))}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Plain paragraph — handle single-newline line breaks within block
    const lines = trimmed.split("\n");
    elements.push(
      <p key={key++} className={`text-sm leading-relaxed ${className}`} style={{ color: "var(--text)" }}>
        {lines.map((line, li) => (
          <span key={li}>
            {renderInline(line)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return <div className="space-y-1">{elements}</div>;
}
