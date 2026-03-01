// @ts-nocheck
"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState, useCallback, useMemo, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Square, SquarePen, Trash2, ChevronDown, AlertCircle, Search, Copy, Check, X, Sparkles, Zap, Brain, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Message } from "ai/react";

// ── Provider brand colors ─────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#74aa9c", Anthropic: "#d4a27f", Meta: "#60a5fa",
  Mistral: "#ff7000", Google: "#4285f4", DeepSeek: "#7c6af7",
  Microsoft: "#0078d4", xAI: "#e7e7e7", Cohere: "#39d3c3", AI21: "#ff6b6b",
};
const PROVIDER_BG: Record<string, string> = {
  OpenAI: "rgba(116,170,156,0.12)", Anthropic: "rgba(212,162,127,0.12)", Meta: "rgba(96,165,250,0.12)",
  Mistral: "rgba(255,112,0,0.12)", Google: "rgba(66,133,244,0.12)", DeepSeek: "rgba(124,106,247,0.12)",
  Microsoft: "rgba(0,120,212,0.12)", xAI: "rgba(231,231,231,0.08)", Cohere: "rgba(57,211,195,0.12)", AI21: "rgba(255,107,107,0.12)",
};

interface FetchedModel {
  id: string; name: string; publisher: string; tier?: string; is_default?: boolean;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function stripToolCallJson(text: string): string {
  return text.replace(/^\s*\{[^}]*"query"[^}]*\}\s*\n?/, "").trimStart();
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={j} className="font-semibold text-white/90">{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={j} className="italic">{part.slice(1, -1)}</em>;
        if (part.startsWith("~~") && part.endsWith("~~"))
          return <s key={j}>{part.slice(2, -2)}</s>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={j} className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ background: "rgba(255,255,255,0.08)", color: "#93c5fd" }}>{part.slice(1, -1)}</code>;
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          const isInternal = href.startsWith("/");
          return (
            <a key={j} href={href} target={isInternal ? "_self" : "_blank"} rel={isInternal ? undefined : "noopener noreferrer"}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "rgba(99,179,237,0.12)", color: "#93c5fd", border: "1px solid rgba(99,179,237,0.25)", textDecoration: "none" }}>
              {label}
            </a>
          );
        }
        return <span key={j}>{part}</span>;
      })}
    </>
  );
}

function renderTable(lines: string[], keyBase: number): React.ReactNode {
  const rows = lines.map(l => l.split("|").slice(1, -1).map(cell => cell.trim())).filter(cells => !cells.every(c => /^[-:]+$/.test(c)));
  if (rows.length === 0) return null;
  const [header, ...body] = rows;
  return (
    <div key={"table-" + keyBase} className="my-3 overflow-x-auto rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
            {header.map((cell, j) => <th key={j} className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)" }}>{inlineFormat(cell)}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)" }}>{inlineFormat(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Table detection
    if (line.includes("|") && i + 1 < lines.length && /^[|\s:-]+$/.test(lines[i + 1])) {
      const tableLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].includes("|")) { tableLines.push(lines[i]); i++; }
      result.push(renderTable(tableLines, i));
      continue;
    }
    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      i++;
      result.push(
        <div key={"code-" + i} className="my-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {lang && <div className="px-3 py-1 text-[10px] font-mono border-b" style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>{lang}</div>}
          <pre className="px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed" style={{ background: "rgba(0,0,0,0.3)", color: "#e2e8f0" }}>{codeLines.join("\n")}</pre>
        </div>
      );
      continue;
    }
    // Headings
    const h3 = line.match(/^###\s+(.*)/); if (h3) { result.push(<h3 key={"h3-" + i} className="text-sm font-bold mt-4 mb-1.5 text-white/90">{inlineFormat(h3[1])}</h3>); i++; continue; }
    const h2 = line.match(/^##\s+(.*)/); if (h2) { result.push(<h2 key={"h2-" + i} className="text-base font-bold mt-5 mb-2 text-white">{inlineFormat(h2[1])}</h2>); i++; continue; }
    const h1 = line.match(/^#\s+(.*)/); if (h1) { result.push(<h1 key={"h1-" + i} className="text-lg font-bold mt-5 mb-2 text-white">{inlineFormat(h1[1])}</h1>); i++; continue; }
    // Blockquote
    const bq = line.match(/^>\s+(.*)/);
    if (bq) { result.push(<blockquote key={"bq-" + i} className="pl-3 border-l-2 my-1 italic text-sm" style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)" }}>{inlineFormat(bq[1])}</blockquote>); i++; continue; }
    // Unordered list
    if (/^[\-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-*]\s/.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      result.push(<ul key={"ul-" + i} className="space-y-1 my-1.5 pl-1">{items.map((item, idx) => <li key={idx} className="flex gap-2 text-sm"><span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.35)" }} /><span style={{ color: "rgba(255,255,255,0.82)" }}>{inlineFormat(item)}</span></li>)}</ul>);
      continue;
    }
    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      result.push(<ol key={"ol-" + i} className="space-y-1 my-1.5 pl-1">{items.map((item, idx) => <li key={idx} className="flex gap-2 text-sm"><span className="flex-shrink-0 text-xs font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.3)", minWidth: "1.2rem" }}>{idx + 1}.</span><span style={{ color: "rgba(255,255,255,0.82)" }}>{inlineFormat(item)}</span></li>)}</ol>);
      continue;
    }
    // Horizontal rule
    if (/^---+$/.test(line.trim())) { result.push(<hr key={"hr-" + i} className="my-3" style={{ borderColor: "rgba(255,255,255,0.08)" }} />); i++; continue; }
    // Empty line
    if (line.trim() === "") { result.push(<div key={"br-" + i} className="h-2" />); i++; continue; }
    // Paragraph
    result.push(<p key={"p-" + i} className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>{inlineFormat(line)}</p>);
    i++;
  }
  return result;
}

// ── AI Avatar ─────────────────────────────────────────────────────────────────
function AIAvatar({ size = 8 }: { size?: number }) {
  const dim = `${size * 4}px`;
  return (
    <div className="rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: dim, height: dim, background: "linear-gradient(135deg, rgba(99,179,237,0.15) 0%, rgba(168,85,247,0.15) 100%)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <Image src="/logo.png" alt="ZeroQCM AI" width={size * 3} height={size * 3} className="object-contain opacity-90" />
    </div>
  );
}

// ── Model Picker ──────────────────────────────────────────────────────────────
function ModelPicker({ models, selected, onSelect, loading }: {
  models: FetchedModel[]; selected: string; onSelect: (id: string) => void; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 60); }, [open]);

  const current = models.find(m => m.id === selected) ?? { id: selected, name: selected, publisher: "AI", tier: "standard" };
  const providerColor = PROVIDER_COLORS[current.publisher] ?? "rgba(255,255,255,0.4)";
  const providerBg = PROVIDER_BG[current.publisher] ?? "rgba(255,255,255,0.06)";

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = models.filter(m => !search || m.name.toLowerCase().includes(q) || m.publisher.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    const map = new Map<string, FetchedModel[]>();
    for (const m of filtered) {
      const g = map.get(m.publisher) ?? [];
      g.push(m); map.set(m.publisher, g);
    }
    return map;
  }, [models, search]);

  const enabledCount = models.filter(m => true).length;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95"
        style={{
          background: open ? providerBg : "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? providerColor + "40" : "rgba(255,255,255,0.1)"}`,
          color: "rgba(255,255,255,0.85)",
          boxShadow: open ? `0 0 0 3px ${providerColor}10` : "none",
        }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: providerColor }} />
        <span className="max-w-[140px] truncate">{loading ? "…" : current.name}</span>
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform duration-150", open && "rotate-180")}
          style={{ color: "rgba(255,255,255,0.4)" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.1 }}
            className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl overflow-hidden z-[70]"
            style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)" }}>

            {/* Search */}
            <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Search className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un modèle…" className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: "rgba(255,255,255,0.85)", caretColor: "#93c5fd" }} />
                {search && <button onClick={() => setSearch("")}><X className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} /></button>}
              </div>
            </div>

            {/* Grouped list */}
            <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
              {loading ? (
                <div className="px-4 py-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Chargement…</div>
              ) : grouped.size === 0 ? (
                <div className="px-4 py-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Aucun modèle trouvé</div>
              ) : (
                Array.from(grouped.entries()).map(([provider, ms]) => (
                  <div key={provider}>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
                      style={{ color: PROVIDER_COLORS[provider] ?? "rgba(255,255,255,0.3)" }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_COLORS[provider] ?? "rgba(255,255,255,0.3)" }} />
                      {provider}
                    </div>
                    {ms.map(m => (
                      <button key={m.id} onClick={() => { onSelect(m.id); setOpen(false); setSearch(""); }}
                        className="w-full text-left px-3 py-2 flex items-center justify-between transition-colors group"
                        style={{ background: selected === m.id ? PROVIDER_BG[provider] ?? "rgba(255,255,255,0.04)" : "transparent" }}
                        onMouseEnter={e => { if (selected !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e => { if (selected !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: selected === m.id ? PROVIDER_COLORS[provider] ?? "#93c5fd" : "rgba(255,255,255,0.85)" }}>{m.name}</span>
                          {m.tier === "premium" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc" }}>PRO</span>
                          )}
                          {m.is_default && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>défaut</span>
                          )}
                        </div>
                        {selected === m.id && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: PROVIDER_COLORS[provider] ?? "#93c5fd" }} />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="px-3 py-2 border-t text-[10px] flex items-center gap-1" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
              <Sparkles className="w-2.5 h-2.5" />
              {enabledCount} modèles disponibles · Copilot API
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      title="Copier"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {copied ? <Check className="w-3 h-3" style={{ color: "#4ade80" }} /> : <Copy className="w-3 h-3" style={{ color: "rgba(255,255,255,0.4)" }} />}
    </button>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "💊", text: "Mécanisme d'action des IEC" },
  { icon: "❓", text: "Donne-moi 3 QCM sur l'HTA" },
  { icon: "🧮", text: "Formule de Cockcroft-Gault" },
  { icon: "💪", text: "QCM sur les muscles squelettiques" },
  { icon: "🦠", text: "Résistance aux antibiotiques" },
  { icon: "🩸", text: "Quiz: hémostase primaire" },
];

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map(k => (
        <motion.div key={k} className="w-1.5 h-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.4)" }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1, repeat: Infinity, delay: k * 0.16, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

// ── DB batch ──────────────────────────────────────────────────────────────────
const DB_BATCH = 12;

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatWithAIPage() {
  const { user, profile } = useAuth();
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-mini");
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savedMsgIds = useRef(new Set<string>());
  const loadedMsgCountRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch admin-curated models ──
  useEffect(() => {
    const CACHE_KEY = "zqcm-models-v3";
    const CACHE_TTL = 3 * 60 * 1000;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache = JSON.parse(raw) as { ts: number; models: FetchedModel[] };
        if (Date.now() - cache.ts < CACHE_TTL && cache.models.length > 0) {
          setFetchedModels(cache.models);
          setLoadingModels(false);
        }
      }
    } catch {}
    fetch("/api/gh-models")
      .then(r => r.json())
      .then((data: FetchedModel[]) => {
        setFetchedModels(data);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), models: data })); } catch {}
      })
      .catch(() => setFetchedModels([
        { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", publisher: "OpenAI", tier: "standard", is_default: true },
        { id: "gpt-4o", name: "GPT-4o", publisher: "OpenAI", tier: "premium" },
      ]))
      .finally(() => setLoadingModels(false));
  }, []);

  // ── Sync model from profile/default ──
  useEffect(() => {
    const fromProfile = (profile?.preferences as Record<string, string> | undefined)?.ai_model;
    if (fromProfile) {
      setSelectedModel(fromProfile);
    } else if (fetchedModels.length > 0) {
      const def = fetchedModels.find(m => m.is_default) ?? fetchedModels[0];
      if (def) setSelectedModel(def.id);
    }
  }, [profile, fetchedModels]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, setInput, stop } = useChat({
    api: "/api/chat",
    body: { model: selectedModel },
    onFinish: (msg) => {
      if (!user || savedMsgIds.current.has(msg.id)) return;
      // persist AI message
    },
  });

  // ── Load chat history from DB ──
  useEffect(() => {
    if (!user || loadedMsgCountRef.current > 0) return;
    supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(60)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const loaded = data.map((r: any) => ({ id: r.id, role: r.role, content: r.content }));
          setMessages(loaded);
          loaded.forEach((m: any) => savedMsgIds.current.add(m.id));
          loadedMsgCountRef.current = loaded.length;
        }
      });
  }, [user, setMessages]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // ── Textarea auto-resize ──
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  // ── Cmd/Ctrl+Enter or Enter to send ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmitWithSave(e as any);
      }
    }
  };

  // ── Submit + save user msg to DB ──
  const handleSubmitWithSave = useCallback((e: React.FormEvent) => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    handleSubmit(e);
    // Reset height
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    }, 0);
    if (!user) return;
    const tempId = `tmp-${Date.now()}`;
    supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: userContent }).then(({ data }) => {
      if (data?.[0]?.id) savedMsgIds.current.add(data[0].id);
    });
  }, [input, isLoading, handleSubmit, user]);

  const handleClear = useCallback(() => {
    setMessages([]);
    savedMsgIds.current.clear();
    loadedMsgCountRef.current = 0;
    if (user) supabase.from("chat_messages").delete().eq("user_id", user.id).then(() => {});
  }, [setMessages, user]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    if (user && profile) {
      const prefs = { ...(profile.preferences ?? {}), ai_model: modelId };
      supabase.from("profiles").update({ preferences: prefs }).eq("id", user.id).then(() => {});
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
      }
    }, 30);
  };

  const isEmpty = messages.length === 0;
  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col chat-root" style={{ height: "calc(100dvh - 5rem)" }}>
      <style>{`
        @media (min-width: 1024px) { .chat-root { height: 100dvh !important; } }
        .chat-messages { scroll-behavior: smooth; overscroll-behavior: contain; }
        .chat-messages::-webkit-scrollbar { width: 3px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
        .chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.13); }
        .msg-user:hover .msg-actions { opacity: 1; }
        .msg-ai:hover .msg-actions { opacity: 1; }
        textarea { -webkit-overflow-scrolling: touch; }
        .send-btn { -webkit-tap-highlight-color: transparent; }
        .suggestion-chip { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* ─────────────────────── Header ─────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "var(--bg)", backdropFilter: "blur(12px)" }}>

        <div className="flex items-center gap-3 min-w-0">
          <AIAvatar size={8} />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight text-white/95">ZeroQCM AI</h1>
            <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>Tuteur médical · {fetchedModels.length} modèles</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEmpty && (
            <button onClick={handleClear}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
              title="Effacer la conversation"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.45)" }} />
            </button>
          )}
          <button onClick={() => { setMessages([]); savedMsgIds.current.clear(); loadedMsgCountRef.current = 0; }}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            title="Nouvelle conversation"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"}>
            <SquarePen className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.45)" }} />
          </button>
        </div>
      </div>

      {/* ─────────────────────── Messages ─────────────────────── */}
      <div className="chat-messages flex-1 overflow-y-auto" ref={containerRef} style={{ background: "var(--bg)" }}>
        <div className="max-w-2xl mx-auto px-4 md:px-6 pb-4">

          {/* ── Empty state ── */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center pt-12 pb-8 gap-8">

                {/* Glow avatar */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full opacity-20 blur-3xl"
                    style={{ background: "radial-gradient(circle, #60a5fa, #a78bfa)", transform: "scale(2.5)" }} />
                  <AIAvatar size={20} />
                </div>

                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-semibold text-white/95">Comment puis-je t&apos;aider ?</h2>
                  <p className="text-sm text-white/35">Mécanismes · QCM · Calculs · Pièges · Révision</p>
                </div>

                {/* Suggestion chips */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s, idx) => (
                    <motion.button key={idx} className="suggestion-chip text-left px-3.5 py-3 rounded-2xl text-xs leading-snug transition-all"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx, duration: 0.25 }}
                      onClick={() => handleSuggestion(s.text)}
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.65)" }}
                      onMouseEnter={e => { Object.assign((e.currentTarget as HTMLButtonElement).style, { borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }); }}
                      onMouseLeave={e => { Object.assign((e.currentTarget as HTMLButtonElement).style, { borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }); }}>
                      <span className="mr-1.5 text-sm">{s.icon}</span>{s.text}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Messages ── */}
          <div className="space-y-4 pt-2">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const inv = (msg as Message & { toolInvocations?: {toolName: string; args?: {query?: string}}[] }).toolInvocations;
                const qcmCall = inv?.find(t => t.toolName === "searchQCM");
                const isLast = i === messages.length - 1;

                return (
                  <motion.div key={msg.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn("flex gap-3", isUser ? "flex-row-reverse msg-user" : "flex-row msg-ai")}>

                    {/* Avatar */}
                    <div className="flex-shrink-0 mt-0.5">
                      {isUser
                        ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold select-none"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                            {user?.email?.[0]?.toUpperCase() ?? "U"}
                          </div>
                        : <AIAvatar size={7} />}
                    </div>

                    <div className={cn("flex flex-col gap-1 max-w-[85%] md:max-w-[78%]", isUser ? "items-end" : "items-start")}>
                      {/* Tool badge */}
                      {!isUser && qcmCall && (
                        <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs w-fit"
                          style={{ background: "rgba(99,179,237,0.06)", border: "1px solid rgba(99,179,237,0.12)", color: "rgba(99,179,237,0.7)" }}>
                          <Search className="w-3 h-3" />
                          <span>Recherche{qcmCall.args?.query ? ` — ${qcmCall.args.query}` : "…"}</span>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div className="relative group w-full">
                        {isUser ? (
                          /* User bubble — dark pill */
                          <div className="px-4 py-2.5 rounded-3xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap select-text"
                            style={{ background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.92)" }}>
                            {msg.content}
                          </div>
                        ) : (
                          /* AI response — flat, no bubble */
                          <div className="text-sm py-1 select-text">
                            <div className="space-y-0.5">
                              {renderMarkdown(stripToolCallJson(msg.content))}
                            </div>
                          </div>
                        )}

                        {/* Action row */}
                        <div className={cn("msg-actions absolute -bottom-6 flex items-center gap-1 opacity-0 transition-opacity", isUser ? "right-0" : "left-0")}>
                          <CopyButton text={msg.content} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isLoading && (
                <motion.div key="typing"
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-3 items-start">
                  <AIAvatar size={7} />
                  <div className="px-3 py-2.5 rounded-2xl rounded-tl-sm"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <TypingDots />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", color: "#f87171" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Erreur de connexion. Vérifie tes tokens AI dans l&apos;admin.
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-8" />
          </div>
        </div>
      </div>

      {/* ─────────────────────── Input ─────────────────────── */}
      <div className="flex-shrink-0 px-3 pb-safe pb-3 pt-2" style={{ background: "var(--bg)" }}>
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmitWithSave}>
            {/* Input container */}
            <motion.div
              animate={{
                borderColor: inputFocused ? "rgba(255,255,255,0.2)" : canSend ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
                boxShadow: inputFocused
                  ? "0 0 0 4px rgba(99,179,237,0.06), 0 8px 32px rgba(0,0,0,0.4)"
                  : "0 2px 16px rgba(0,0,0,0.25)",
              }}
              transition={{ duration: 0.15 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

              {/* Textarea */}
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
                className="w-full bg-transparent resize-none outline-none text-sm px-4 pt-3.5 pb-2 placeholder:text-white/25"
                style={{
                  color: "rgba(255,255,255,0.92)",
                  caretColor: "#93c5fd",
                  minHeight: "52px",
                  maxHeight: "200px",
                  lineHeight: "1.55",
                  WebkitAppearance: "none",
                }}
              />

              {/* Bottom row */}
              <div className="flex items-center justify-between px-3 pb-3 gap-2">
                {/* Model picker */}
                <ModelPicker models={fetchedModels} selected={selectedModel} onSelect={handleModelChange} loading={loadingModels} />

                {/* Send / Stop button */}
                <motion.button
                  type={isLoading ? "button" : "submit"}
                  onClick={isLoading ? () => stop() : undefined}
                  disabled={!isLoading && !canSend}
                  className="send-btn w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                  animate={{
                    background: isLoading ? "rgba(239,68,68,0.15)" : canSend ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.06)",
                    scale: canSend || isLoading ? 1 : 0.88,
                  }}
                  transition={{ duration: 0.12 }}
                  style={{
                    border: isLoading ? "1px solid rgba(239,68,68,0.3)" : "none",
                  }}>
                  {isLoading
                    ? <Square className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
                    : <ArrowUp className="w-4 h-4" style={{ color: canSend ? "#000" : "rgba(255,255,255,0.25)" }} />}
                </motion.button>
              </div>
            </motion.div>

            <p className="text-center text-[10px] mt-2 opacity-0 pointer-events-none" style={{ color: "rgba(255,255,255,0.2)" }}>
              Enter · envoyer · Shift+Enter · nouvelle ligne
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
