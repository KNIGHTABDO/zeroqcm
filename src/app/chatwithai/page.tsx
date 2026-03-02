// @ts-nocheck
"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowUp, Square, SquarePen, Trash2, ChevronDown,
  AlertCircle, Search, Copy, Check, X, Sparkles, Zap, MessageSquare, SidebarOpen, SidebarClose
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";
import type { Message } from "ai/react";

// ── Thinking model detection ────────────────────────────────────────
function isThinkingCapable(modelId: string): boolean {
  return (
    modelId.startsWith("claude-") ||
    modelId === "gpt-5.1" ||
    modelId === "gpt-5-mini" ||
    modelId.startsWith("gpt-5.1-codex")
  );
}

interface FetchedModel {
  id: string; name: string; publisher: string;
  tier?: string; is_default?: boolean;
  supports_thinking?: boolean; supports_vision?: boolean;
}

// ── Markdown renderer ───────────────────────────────────────────────
function stripToolCallJson(text: string): string {
  return text.replace(/^\s*\{[^}]*"query"[^}]*\}\s*\n?/, "").trimStart();
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={j} className="font-semibold" style={{ color: "var(--text)" }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={j}>{part.slice(1, -1)}</em>;
        if (part.startsWith("~~") && part.endsWith("~~"))
          return <s key={j}>{part.slice(2, -2)}</s>;
        if (part.startsWith("`") && part.endsWith("`"))
          return (
            <code key={j} className="px-1.5 py-0.5 rounded text-xs font-mono"
              style={{ background: "var(--surface-alt)", color: "var(--accent)", border: "1px solid var(--border)" }}>
              {part.slice(1, -1)}
            </code>
          );
        const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (lm)
          return (
            <a key={j} href={lm[2]} target={lm[2].startsWith("/") ? "_self" : "_blank"}
              rel="noopener noreferrer" className="underline underline-offset-2"
              style={{ color: "var(--accent)" }}>{lm[1]}</a>
          );
        return <span key={j}>{part}</span>;
      })}
    </>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.includes("|") && i + 1 < lines.length && /^[|\s:-]+$/.test(lines[i + 1])) {
      const tableLines: string[] = [line]; i++;
      while (i < lines.length && lines[i].includes("|")) { tableLines.push(lines[i]); i++; }
      const rows = tableLines.map(l => l.split("|").slice(1, -1).map(c => c.trim())).filter(cells => !cells.every(c => /^[-:]+$/.test(c)));
      if (rows.length) {
        const [header, ...body] = rows;
        result.push(
          <div key={"t"+i} className="my-3 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                  {header.map((h, hi) => <th key={hi} className="px-3 py-2 text-left text-[12px] font-semibold" style={{ color: "var(--text)" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>{inlineFormat(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim(); i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      result.push(
        <div key={"c"+i} className="my-3 rounded-xl overflow-hidden" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          {lang && (
            <div className="px-3 py-1.5 text-[10px] font-mono font-medium" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3 text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)", fontFamily: "ui-monospace, SF Mono, Menlo, monospace" }}>
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^(#{1,6})\s/)?.[1].length ?? 1;
      const text = line.slice(level + 1);
      const sizes = ["text-xl","text-lg","text-base","text-sm","text-sm","text-sm"];
      result.push(
        <p key={i} className={cn(sizes[level-1], "font-bold mt-4 mb-2")} style={{ color: "var(--text)" }}>
          {inlineFormat(text)}
        </p>
      );
      i++; continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2)); i++;
      }
      result.push(
        <ul key={"ul"+i} className="list-none space-y-1.5 my-2 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex items-start gap-2 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--text-muted)" }} />
              <span>{inlineFormat(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []; let n = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, "")); i++;
      }
      result.push(
        <ol key={"ol"+i} className="space-y-1.5 my-2 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex items-start gap-2.5 text-[14px]" style={{ color: "var(--text-secondary)" }}>
              <span className="text-[11px] font-bold mt-0.5 tabular-nums flex-shrink-0" style={{ color: "var(--text-muted)" }}>{ii+1}.</span>
              <span>{inlineFormat(it)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }
    if (line.startsWith("> ")) {
      result.push(
        <div key={i} className="pl-3 my-2 text-[13px] italic" style={{ borderLeft: "2px solid var(--border-strong)", color: "var(--text-secondary)" }}>
          {inlineFormat(line.slice(2))}
        </div>
      );
      i++; continue;
    }
    if (line.trim() === "" || line === "---" || line === "***") { result.push(<div key={i} className="h-3" />); i++; continue; }
    result.push(
      <p key={i} className="text-[14px] leading-relaxed my-1" style={{ color: "var(--text-secondary)" }}>
        {inlineFormat(line)}
      </p>
    );
    i++;
  }
  return result;
}

// ── Neutral model badge (replaces PROVIDER_COLORS entirely) ─────────
function ModelBadge({ publisher, name }: { publisher: string; name: string }) {
  const initials = publisher.slice(0, 2).toUpperCase();
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
      style={{ background: "var(--surface-alt)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
      <span className="font-bold text-[10px]" style={{ color: "var(--text-secondary)" }}>{initials}</span>
      <span className="truncate max-w-[80px]">{name}</span>
    </span>
  );
}

// ── Model picker (redesigned) ────────────────────────────────────────
function ModelPicker({
  models, selected, onSelect, loading, quotaRemaining
}: {
  models: FetchedModel[]; selected: string; onSelect: (id: string) => void;
  loading: boolean; quotaRemaining?: { remaining: number; limit: number; multiplier: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 50); }, [open]);

  const current = models.find(m => m.id === selected) ?? { id: selected, name: selected, publisher: "AI", tier: "standard" };

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = models.filter(m =>
      !search || m.name.toLowerCase().includes(q) || m.publisher.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
    const map = new Map<string, FetchedModel[]>();
    for (const m of filtered) {
      const g = map.get(m.publisher) ?? [];
      g.push(m);
      map.set(m.publisher, g);
    }
    return map;
  }, [models, search]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all active:scale-95 select-none"
        style={{
          background: open ? "var(--surface-alt)" : "var(--surface-alt)",
          border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
          color: "var(--text-secondary)",
        }}
      >
        <span className="max-w-[90px] sm:max-w-[140px] truncate">{loading ? "…" : current.name}</span>
        <ChevronDown
          className={cn("w-3 h-3 flex-shrink-0 transition-transform duration-200", open && "rotate-180")}
          style={{ color: "var(--text-muted)" }}
        />
        {quotaRemaining && quotaRemaining.multiplier > 0 && (
          <span className="hidden sm:inline text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {quotaRemaining.remaining}/{quotaRemaining.limit}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && typeof window !== "undefined" && (() => {
          const rect = ref.current?.querySelector("button")?.getBoundingClientRect();
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="fixed w-72 rounded-xl z-[70] overflow-hidden"
              style={{
                bottom: rect ? window.innerHeight - rect.top + 8 : 80,
                left: Math.min(rect?.left ?? 16, window.innerWidth - 296),
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow)",
              }}
            >
              {/* Search */}
              <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: "var(--surface-alt)" }}>
                  <Search className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un modèle…"
                    className="flex-1 bg-transparent text-[12px] outline-none border-none shadow-none"
                    style={{ color: "var(--text)", caretColor: "var(--accent)" }}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")}>
                      <X className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </button>
                  )}
                </div>
              </div>

              {/* Model list */}
              <div className="overflow-y-auto max-h-72 p-1.5 space-y-3">
                {[...grouped.entries()].map(([publisher, mods]) => (
                  <div key={publisher}>
                    <p className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      {publisher}
                    </p>
                    {mods.map(m => {
                      const isSelected = m.id === selected;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => { onSelect(m.id); setOpen(false); setSearch(""); }}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all duration-100"
                          style={{
                            background: isSelected ? "var(--surface-alt)" : "transparent",
                            color: "var(--text)",
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium truncate">{m.name}</p>
                            {m.tier && m.tier !== "standard" && (
                              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.tier}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            {(() => {
                              const mult = (m as any).premium_multiplier ?? 0;
                              if (mult === 0) return (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                                  style={{ background: "var(--success-subtle)", color: "var(--success)", border: "1px solid var(--success-border)" }}>
                                  FREE
                                </span>
                              );
                              return (
                                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
                                  style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                                  ×{mult}
                                </span>
                              );
                            })()}
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full flex items-center justify-center"
                                style={{ background: "var(--accent)" }}>
                                <Check className="w-2.5 h-2.5" style={{ color: "var(--bg)" }} />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
                {grouped.size === 0 && (
                  <p className="text-center py-4 text-[12px]" style={{ color: "var(--text-muted)" }}>Aucun résultat</p>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ── Copy button ──────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy}
      className="p-1.5 rounded-md transition-all active:scale-90"
      style={{ color: "var(--text-muted)" }}>
      {copied
        ? <Check className="w-3.5 h-3.5" style={{ color: "var(--success)" }} />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function ChatWithAIPage() {
  const { user, profile } = useAuth();
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-mini");
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savedMsgIds = useRef(new Set<string>());
  const loadedMsgCountRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingModels(true);
    fetch("/api/gh-models")
      .then(r => r.json())
      .then((data: FetchedModel[]) => { setFetchedModels(data); setLoadingModels(false); })
      .catch(() => {
        setFetchedModels([
          { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", publisher: "OpenAI", tier: "standard", is_default: true },
          { id: "gpt-4o", name: "GPT-4o", publisher: "OpenAI", tier: "premium" },
        ]);
        setLoadingModels(false);
      });
  }, []);

  useEffect(() => {
    if (fetchedModels.length === 0) return;
    const adminDefault = fetchedModels.find(m => m.is_default) ?? fetchedModels[0];
    const fromProfile = (profile?.preferences as Record<string, string> | undefined)?.ai_model;
    if (fromProfile && fetchedModels.some(m => m.id === fromProfile)) {
      setSelectedModel(fromProfile);
    } else {
      setSelectedModel(adminDefault.id);
      if (profile) {
        const prefs = { ...(profile.preferences ?? {}), ai_model: adminDefault.id };
        supabase.from("profiles").update({ preferences: prefs }).eq("id", profile.id).then(() => {});
      }
    }
  }, [profile, fetchedModels]);

  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<{ remaining: number; limit: number; multiplier: number } | null>(null);
  type QuotaCategory = { multiplier: number; label: string; color: string; used: number; limit: number; remaining: number | null; unlimited: boolean };
  const [quotaCategories, setQuotaCategories] = useState<QuotaCategory[]>([]);
  const [quotaLoaded, setQuotaLoaded] = useState(false);

  const fetchQuota = async () => {
    try {
      const res = await fetch("/api/user/quota");
      if (res.ok) { const data = await res.json(); setQuotaCategories(data.categories ?? []); setQuotaLoaded(true); }
    } catch { /* non-fatal */ }
  };
  useEffect(() => { fetchQuota(); }, []); // eslint-disable-line

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, setInput, stop, reload } = useChat({
    api: "/api/chat",
    body: { model: selectedModel, thinking: thinkingMode },
    onError: (err) => {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.error === "rate_limited") setRateLimitMsg(parsed.message ?? "Limite journalière atteinte.");
        else if (parsed?.error === "unauthorized") setRateLimitMsg("Connecte-toi pour utiliser les modèles premium.");
      } catch { /* noop */ }
    },
    onFinish: (message, options) => {
      fetchQuota();
      try {
        const remaining = options?.response?.headers?.get?.("X-Quota-Remaining");
        const limit = options?.response?.headers?.get?.("X-Quota-Limit");
        const mult = options?.response?.headers?.get?.("X-Quota-Multiplier");
        if (remaining != null && limit && mult && parseInt(mult) > 0) {
          setQuotaRemaining({ remaining: parseInt(remaining), limit: parseInt(limit), multiplier: parseInt(mult) });
        } else { setQuotaRemaining(null); }
      } catch { /* noop */ }
      if (!user || message.role !== "assistant") return;
      fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: message.content }),
      });
    },
  });

  // Load history
  useEffect(() => {
    if (!user || loadedMsgCountRef.current > 0) return;
    fetch("/api/chat/history")
      .then(r => r.json())
      .then(({ messages: data }) => {
        if (data && data.length > 0) {
          const loaded = data.map((r: any) => ({ id: r.id, role: r.role, content: r.content }));
          setMessages(loaded);
          loaded.forEach((m: any) => savedMsgIds.current.add(m.id));
          loadedMsgCountRef.current = loaded.length;
        }
      });
  }, [user, setMessages]);

  // Auto-scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const endEl = messagesEndRef.current;
    if (endEl) endEl.scrollIntoView({ behavior: "smooth", block: "end" });
    else el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (input.trim() && !isLoading) handleSubmitWithSave(e as any);
    }
  };

  const handleSubmitWithSave = useCallback((e: React.FormEvent) => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    handleSubmit(e);
    setTimeout(() => { if (inputRef.current) inputRef.current.style.height = "auto"; }, 0);
    if (!user) return;
    fetch("/api/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", content: userContent }),
    });
  }, [input, isLoading, handleSubmit, user]);

  const handleModelChange = useCallback((id: string) => {
    setSelectedModel(id);
    if (profile) {
      const prefs = { ...(profile.preferences ?? {}), ai_model: id };
      supabase.from("profiles").update({ preferences: prefs }).eq("id", profile.id).then(() => {});
    }
  }, [profile]);

  const handleClearHistory = useCallback(async () => {
    setMessages([]);
    savedMsgIds.current.clear();
    loadedMsgCountRef.current = 0;
    if (user) await fetch("/api/chat/history", { method: "DELETE" });
  }, [user, setMessages]);

  const canSend = input.trim().length > 0;
  const current = fetchedModels.find(m => m.id === selectedModel);

  return (
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{ background: "var(--bg)", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
    >
      {/* ── Left: desktop sidebar is the app sidebar (lg:ml-60) ── */}
      {/* ── Mobile history drawer ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="hbdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-30 lg:hidden"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              key="hbpanel"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.8 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-40 lg:hidden flex flex-col"
              style={{
                background: "var(--surface)",
                borderRight: "1px solid var(--border)",
                paddingTop: "max(16px, env(safe-area-inset-top))",
              }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Historique</p>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {messages.filter(m => m.role === "user").slice(0, 20).map((m, i) => (
                  <div key={i} className="px-3 py-2.5 rounded-lg mb-0.5 cursor-pointer transition-all"
                    style={{ background: "transparent", color: "var(--text-secondary)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-alt)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <p className="text-[13px] truncate">{m.content.slice(0, 60)}</p>
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-center py-8 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    Aucun message
                  </p>
                )}
              </div>
              {messages.length > 0 && (
                <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    onClick={() => { handleClearHistory(); setSidebarOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[12px] transition-all"
                    style={{ color: "var(--error)" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Effacer l'historique
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">

        {/* ── Top bar ── */}
        <div
          className="flex items-center justify-between px-3 sm:px-4 flex-shrink-0"
          style={{
            height: 52,
            background: "var(--bg)",
            borderBottom: "1px solid var(--border)",
            paddingTop: "env(safe-area-inset-top)",
          }}
        >
          <div className="flex items-center gap-2.5">
            {/* Back to app */}
            <Link href="/semestres"
              className="flex items-center gap-1.5 p-1.5 rounded-lg transition-all"
              style={{ color: "var(--text-muted)" }}
              title="Retour à l'application"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            {/* Mobile: sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg transition-all"
              style={{ color: "var(--text-muted)" }}
            >
              <SidebarOpen className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>Chat IA</span>
            </div>
            {current && (
              <ModelBadge publisher={current.publisher} name={current.name} />
            )}
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-lg transition-all hidden sm:flex"
                style={{ color: "var(--text-muted)" }}
                title="Effacer l'historique"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => { setMessages([]); savedMsgIds.current.clear(); loadedMsgCountRef.current = 0; }}
              className="p-2 rounded-lg transition-all"
              style={{ color: "var(--text-muted)" }}
              title="Nouveau chat"
            >
              <SquarePen className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Rate limit toast ── */}
        <AnimatePresence>
          {rateLimitMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mx-3 mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px]"
              style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)", color: "var(--error)" }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">{rateLimitMsg}</span>
              <button onClick={() => setRateLimitMsg(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Quota bar ── */}
        {quotaLoaded && quotaCategories.some(c => !c.unlimited) && (
          <div className="mx-3 mt-2 flex gap-3">
            {quotaCategories.filter(c => !c.unlimited).map(cat => {
              const pct = cat.limit > 0 ? Math.round((cat.used / cat.limit) * 100) : 0;
              const isAtLimit = cat.remaining === 0;
              return (
                <div key={cat.multiplier} className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>{cat.label}</span>
                    <span className="text-[10px] font-semibold tabular-nums"
                      style={{ color: isAtLimit ? "var(--error)" : "var(--text-muted)" }}>
                      {cat.used}/{cat.limit}
                    </span>
                  </div>
                  <div className="h-[2px] rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: isAtLimit ? "var(--error)" : pct >= 70 ? "var(--warning)" : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Messages ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center px-4 space-y-4"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              >
                <Sparkles className="w-6 h-6" style={{ color: "var(--accent)" }} />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                  Assistant médical IA
                </h2>
                <p className="text-[14px] max-w-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Pose ta question sur l'anatomie, la pharmacologie, la physiologie ou n'importe quel sujet médical.
                </p>
              </div>
              {/* Suggested prompts */}
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {[
                  "Explique le cycle de Krebs",
                  "Quelles sont les urgences en cardiologie ?",
                  "Résume les antibiotiques β-lactamines",
                ].map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="text-left px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150"
                    style={{
                      background: "var(--surface-alt)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const rawText = typeof msg.content === "string" ? msg.content : "";
            const cleanText = isUser ? rawText : stripToolCallJson(rawText);
            return (
              <motion.div
                key={msg.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}
              >
                {/* AI avatar */}
                {!isUser && (
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  </div>
                )}

                <div className={cn("max-w-[85%] sm:max-w-[78%]", isUser && "items-end")}>
                  {isUser ? (
                    <div
                      className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed"
                      style={{
                        background: "var(--surface-alt)",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {cleanText}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[14px] leading-relaxed prose-ai">
                        {renderMarkdown(cleanText)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CopyButton text={cleanText} />
                        {i === messages.length - 1 && !isLoading && (
                          <button
                            onClick={() => reload()}
                            className="p-1.5 rounded-md transition-all active:scale-90"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Streaming indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--text-muted)" }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{ duration: 0.9, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} className="h-2" />
        </div>

        {/* ── Input area ── */}
        <div
          className="flex-shrink-0 px-3 sm:px-4 py-3"
          style={{
            background: "var(--bg)",
            borderTop: "1px solid var(--border)",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <form onSubmit={handleSubmitWithSave}>
            <motion.div
              animate={{
                borderColor: inputFocused ? "var(--border-strong)" : "var(--border)",
                borderColor: inputFocused ? "var(--border-strong)" : "var(--border)",
              }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="Pose ta question médicale…"
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent resize-none outline-none border-none px-4 pt-3.5 pb-2"
                style={{
                  color: "var(--text)",
                  caretColor: "var(--accent)",
                  minHeight: "52px",
                  maxHeight: "200px",
                  lineHeight: "1.6",
                  fontSize: "16px",
                  fontFamily: "inherit",
                }}
              />

              {/* Input toolbar */}
              <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                <div className="flex items-center gap-1.5">
                  <ModelPicker
                    models={fetchedModels}
                    selected={selectedModel}
                    onSelect={handleModelChange}
                    loading={loadingModels}
                    quotaRemaining={quotaRemaining}
                  />

                  {/* Thinking mode toggle */}
                  {isThinkingCapable(selectedModel) && (
                    <button
                      type="button"
                      onClick={() => setThinkingMode(v => !v)}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all active:scale-95"
                      style={{
                        background: thinkingMode ? "var(--accent-subtle)" : "transparent",
                        border: `1px solid ${thinkingMode ? "var(--accent-border)" : "var(--border)"}`,
                        color: thinkingMode ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      <Zap className="w-3 h-3" style={{ fill: thinkingMode ? "var(--accent)" : "none" }} />
                      <span className="hidden xs:inline">Réfl.</span>
                    </button>
                  )}
                </div>

                {/* Send / stop button */}
                <motion.button
                  type={isLoading ? "button" : "submit"}
                  onClick={isLoading ? () => stop() : undefined}
                  disabled={!isLoading && !canSend}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
                  animate={{
                    background: isLoading ? "var(--error-subtle)"
                              : canSend ? "var(--accent)"
                              : "var(--surface-alt)",
                    scale: canSend || isLoading ? 1 : 0.88,
                  }}
                  transition={{ duration: 0.12 }}
                  style={{ border: isLoading ? "1px solid var(--error-border)" : "none" }}
                >
                  {isLoading
                    ? <Square className="w-3.5 h-3.5" style={{ color: "var(--error)" }} />
                    : <ArrowUp className="w-4 h-4" style={{ color: canSend ? "#fff" : "var(--text-disabled)" }} />
                  }
                </motion.button>
              </div>
            </motion.div>
          </form>
        </div>
      </div>
    </div>
  );
}
