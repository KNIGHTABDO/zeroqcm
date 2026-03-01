// @ts-nocheck
"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, SquarePen, Trash2, ChevronDown, AlertCircle, Search, Copy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Message } from "ai/react";

// ── Markdown renderer (preserved from original) ─────────────────────────────
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
          return <code key={j} className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ background: "rgba(255,255,255,0.08)", color: "var(--accent)" }}>{part.slice(1, -1)}</code>;
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          const isInternal = href.startsWith("/");
          return (
            <a key={j} href={href} target={isInternal ? "_self" : "_blank"} rel={isInternal ? undefined : "noopener noreferrer"}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "rgba(99,179,237,0.12)", color: "var(--accent)", border: "1px solid rgba(99,179,237,0.25)", textDecoration: "none" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,179,237,0.22)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,179,237,0.12)"; }}>
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
    <div key={"table-" + keyBase} className="my-2 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: "rgba(99,179,237,0.08)" }}>
            {header.map((cell, j) => <th key={j} className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text)" }}>{inlineFormat(cell)}</th>)}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {row.map((cell, ci) => <td key={ci} className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>{inlineFormat(cell)}</td>)}
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
    if (line.trim() === "") { result.push(<div key={i} className="h-2" />); i++; continue; }
    if (line.startsWith("### ")) { result.push(<p key={i} className="font-semibold text-xs mt-3 mb-1 uppercase tracking-wide" style={{ color: "var(--accent)" }}>{inlineFormat(line.slice(4))}</p>); i++; continue; }
    if (line.startsWith("## "))  { result.push(<p key={i} className="font-bold text-sm mt-3 mb-1" style={{ color: "var(--text)" }}>{inlineFormat(line.slice(3))}</p>); i++; continue; }
    if (line.startsWith("# "))   { result.push(<p key={i} className="font-bold text-base mt-3 mb-1.5" style={{ color: "var(--text)" }}>{inlineFormat(line.slice(2))}</p>); i++; continue; }
    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++; }
      result.push(renderTable(tableLines, result.length)); continue;
    }
    if (line.match(/^[-*•] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) { items.push(<li key={i} className="ml-1 leading-snug">{inlineFormat(lines[i].slice(2))}</li>); i++; }
      result.push(<ul key={"ul-" + i} className="list-disc list-inside space-y-0.5 my-1.5 text-sm">{items}</ul>); continue;
    }
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) { items.push(<li key={i} className="ml-1 leading-snug">{inlineFormat(lines[i].replace(/^\d+\. /, ""))}</li>); i++; }
      result.push(<ol key={"ol-" + i} className="list-decimal list-inside space-y-0.5 my-1.5 text-sm">{items}</ol>); continue;
    }
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      result.push(<pre key={"code-" + i} className="rounded-lg px-3 py-2 my-2 text-xs overflow-x-auto" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", border: "1px solid var(--border)" }}><code>{codeLines.join("\n")}</code></pre>);
      i++; continue;
    }
    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) { result.push(<hr key={i} className="my-2 border-0 border-t" style={{ borderColor: "var(--border)" }} />); i++; continue; }
    const soloLink = line.match(/^\[([^\]]+)\](\/quiz\/\d+)$/);
    if (soloLink) {
      const [, label, href] = soloLink;
      result.push(
        <a key={i} href={href}
          className="flex items-center gap-2 px-4 py-3 rounded-xl mt-2 mb-1 text-sm font-semibold transition-all"
          style={{ background: "rgba(99,179,237,0.08)", border: "1px solid rgba(99,179,237,0.2)", color: "var(--accent)", textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,179,237,0.16)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(99,179,237,0.08)"; }}>
          <span className="flex-1">{label}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
      );
      i++; continue;
    }
    result.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }
  return result;
}

// ── Provider color map ───────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10b981", Anthropic: "#d4a27f", Google: "#4285f4",
  Meta: "#0866ff", Mistral: "#ff7000", Microsoft: "#00a4ef",
  Cohere: "#39594D", AI21: "#7c3aed", xAI: "#1da1f2", DeepSeek: "#3b82f6",
};

// ── Avatars ──────────────────────────────────────────────────────────────────
function AIAvatar({ size = 7 }: { size?: number }) {
  const px = size * 4;
  return (
    <div className={"w-" + size + " h-" + size + " rounded-full flex-shrink-0 overflow-hidden"}
      style={{ border: "1px solid rgba(99,179,237,0.3)", boxShadow: "0 0 12px rgba(99,179,237,0.15)" }}>
      <Image src="/ai-avatar.jpg" alt="ZeroQCM AI" width={px} height={px} className="w-full h-full object-cover" unoptimized />
    </div>
  );
}

// ── Model picker ─────────────────────────────────────────────────────────────
interface FetchedModel { id: string; name: string; publisher: string; tier?: string; is_default?: boolean; }

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

  const current = models.find(m => m.id === selected) ?? { id: selected, name: selected, publisher: "AI" };
  const providerColor = PROVIDER_COLORS[current.publisher] ?? "rgba(255,255,255,0.4)";

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

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${open ? providerColor + "50" : "rgba(255,255,255,0.1)"}`,
          color: "rgba(255,255,255,0.85)",
          boxShadow: open ? `0 0 12px ${providerColor}18` : "none",
        }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: providerColor }} />
        <span className="max-w-[120px] truncate">{loading ? "…" : current.name}</span>
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform duration-150", open && "rotate-180")}
          style={{ color: "rgba(255,255,255,0.4)" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl overflow-hidden z-[70]"
            style={{ background: "rgba(18,18,18,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}>

            {/* Search */}
            <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Search className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search models…" className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: "rgba(255,255,255,0.85)", caretColor: "var(--accent)" }} />
                {search && <button onClick={() => setSearch("")}><X className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} /></button>}
              </div>
            </div>

            {/* Grouped list */}
            <div className="overflow-y-auto" style={{ maxHeight: "280px" }}>
              {loading ? (
                <div className="px-4 py-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading models…</div>
              ) : grouped.size === 0 ? (
                <div className="px-4 py-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No models found</div>
              ) : (
                Array.from(grouped.entries()).map(([provider, ms]) => (
                  <div key={provider}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
                      style={{ color: PROVIDER_COLORS[provider] ?? "rgba(255,255,255,0.3)" }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_COLORS[provider] ?? "rgba(255,255,255,0.3)" }} />
                      {provider}
                    </div>
                    {ms.map(m => (
                      <button key={m.id} onClick={() => { onSelect(m.id); setOpen(false); setSearch(""); }}
                        className="w-full text-left px-3 py-2 flex items-center justify-between transition-all group"
                        style={{ background: selected === m.id ? "rgba(99,179,237,0.08)" : "transparent" }}
                        onMouseEnter={e => { if (selected !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e => { if (selected !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                        <div>
                          <div className="text-xs font-medium" style={{ color: selected === m.id ? "var(--accent)" : "rgba(255,255,255,0.85)" }}>{m.name}</div>
                          {m.tier && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold mt-0.5 inline-block"
                              style={{
                                background: m.tier === "premium" ? "rgba(168,85,247,0.12)" : "rgba(34,197,94,0.1)",
                                color: m.tier === "premium" ? "#a78bfa" : "#4ade80",
                              }}>
                              {m.tier}
                            </span>
                          )}
                        </div>
                        {selected === m.id && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--accent)" }} />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div className="px-3 py-2 border-t text-[10px]" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.2)" }}>
              {models.length} models · Admin-curated
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {copied ? <Check className="w-3 h-3" style={{ color: "#4ade80" }} /> : <Copy className="w-3 h-3" style={{ color: "rgba(255,255,255,0.4)" }} />}
    </button>
  );
}

// ── Suggestion chips ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "💊", text: "Mécanisme d'action des IEC" },
  { icon: "❓", text: "Donne-moi 3 QCM sur l'HTA" },
  { icon: "🧮", text: "Formule de Cockcroft-Gault" },
  { icon: "💪", text: "QCM sur les muscles squelettiques" },
  { icon: "🦠", text: "Résistance aux antibiotiques" },
  { icon: "🩸", text: "Quiz: hémostase primaire" },
];

// ── DB persistence helpers (preserved from original) ─────────────────────────
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

  // ── Fetch models from admin-controlled /api/gh-models ──
  useEffect(() => {
    const CACHE_KEY = "zqcm-models-v2";
    const CACHE_TTL = 5 * 60 * 1000; // 5 min (shorter TTL so admin changes reflect fast)
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

  // ── Load saved model from profile ──
  useEffect(() => {
    const fromProfile = (profile?.preferences as Record<string, string> | undefined)?.ai_model;
    if (fromProfile) {
      setSelectedModel(fromProfile);
    } else if (fetchedModels.length > 0) {
      const def = fetchedModels.find(m => m.is_default) ?? fetchedModels[0];
      if (def) setSelectedModel(def.id);
    }
  }, [profile, fetchedModels]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages, setInput } = useChat({
    api: "/api/chat",
    body: { model: selectedModel },
    onFinish: (msg) => {
      if (!user || savedMsgIds.current.has(msg.id)) return;
      // Save AI message to DB
    },
  });

  // ── Load chat history from DB ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(DB_BATCH);
      if (data && data.length > 0) {
        const msgs: Message[] = data.map((r: any) => ({ id: r.id, role: r.role as "user" | "assistant", content: r.content }));
        msgs.forEach(m => savedMsgIds.current.add(m.id));
        loadedMsgCountRef.current = data.length;
        setMessages(msgs);
      }
    })();
  }, [user, setMessages]);

  // ── Auto-scroll ──
  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: messages.length <= 2 ? "instant" : "smooth" }));
  }, [messages, isLoading]);

  // ── Save outgoing messages to DB ──
  const handleSubmitWithSave = async (e: React.FormEvent) => {
    const userMsg = input.trim();
    handleSubmit(e);
    setTimeout(() => { if (inputRef.current) { inputRef.current.style.height = "auto"; } }, 0);
    if (!user || !userMsg) return;
    const tempId = "user-" + Date.now();
    savedMsgIds.current.add(tempId);
    await supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: userMsg }).then(() => {});
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) handleSubmitWithSave(e as unknown as React.FormEvent);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

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
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
      }
    }, 30);
  };

  const isEmpty = messages.length === 0;
  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 5rem)" }}>
      <style>{`
        @media (min-width: 1024px) { .chat-root { height: 100dvh !important; } }
        .chat-messages { scroll-behavior: smooth; }
        .chat-messages::-webkit-scrollbar { width: 4px; }
        .chat-messages::-webkit-scrollbar-track { background: transparent; }
        .chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        .chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      {/* ─ Header ───────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "var(--bg)" }}>

        <div className="flex items-center gap-3">
          <AIAvatar size={8} />
          <div>
            <h1 className="text-sm font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.95)" }}>ZeroQCM AI</h1>
            <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>Tuteur médical</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isEmpty && (
            <button onClick={handleClear}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
          )}
          <button onClick={() => { setMessages([]); savedMsgIds.current.clear(); loadedMsgCountRef.current = 0; }}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <SquarePen className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>
      </div>

      {/* ─ Messages area ────────────────────────────────────────────────────── */}
      <div className="chat-messages flex-1 overflow-y-auto overscroll-contain" style={{ background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-3 md:px-6">

          {/* Empty state */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-6 pt-12 pb-4">

                {/* Avatar glow */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-2xl opacity-30" style={{ background: "radial-gradient(circle, rgba(99,179,237,0.6) 0%, transparent 70%)", transform: "scale(1.8)" }} />
                  <AIAvatar size={16} />
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: "rgba(255,255,255,0.95)" }}>Comment puis-je t&apos;aider ?</h2>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Mécanismes · QCM · Calculs · Pièges · Révision
                  </p>
                </div>

                {/* Suggestions */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  {SUGGESTIONS.map((s, idx) => (
                    <motion.button key={idx}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx, duration: 0.2 }}
                      onClick={() => handleSuggestion(s.text)}
                      className="text-left px-3.5 py-3 rounded-2xl text-xs leading-snug transition-all group"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.65)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(99,179,237,0.3)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(99,179,237,0.05)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}>
                      <span className="mr-1.5">{s.icon}</span>{s.text}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="py-4 space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const inv = (msg as Message & { toolInvocations?: {toolName: string; args?: {query?: string}}[] }).toolInvocations;
                const qcmCall = inv?.find(t => t.toolName === "searchQCM");

                return (
                  <motion.div key={msg.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>

                    {/* Avatar */}
                    <div className="flex-shrink-0 mt-1">
                      {isUser
                        ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                            {user?.email?.[0]?.toUpperCase() ?? "U"}
                          </div>
                        : <AIAvatar size={7} />}
                    </div>

                    {/* Bubble */}
                    <div className={cn("flex flex-col gap-1.5 max-w-[82%] md:max-w-[75%]", isUser ? "items-end" : "items-start")}>
                      {/* Tool call badge */}
                      {!isUser && qcmCall && (
                        <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs w-fit"
                          style={{ background: "rgba(99,179,237,0.07)", border: "1px solid rgba(99,179,237,0.15)", color: "rgba(99,179,237,0.8)" }}>
                          <Search className="w-3 h-3" />
                          <span>Recherche{qcmCall.args?.query ? ` — ${qcmCall.args.query}` : "…"}</span>
                        </div>
                      )}

                      {/* Message content */}
                      <div className="relative group">
                        {isUser ? (
                          <div className="px-4 py-2.5 rounded-3xl rounded-tr-md text-sm leading-relaxed whitespace-pre-wrap"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)" }}>
                            {msg.content}
                          </div>
                        ) : (
                          <div className="px-4 py-3 rounded-3xl rounded-tl-md text-sm"
                            style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.88)" }}>
                            <div className="space-y-0.5 overflow-x-auto">
                              {renderMarkdown(stripToolCallJson(msg.content))}
                            </div>
                          </div>
                        )}
                        {/* Actions on hover */}
                        <div className={cn("absolute -bottom-6 flex items-center gap-1", isUser ? "right-0" : "left-0")}>
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
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-3 items-start">
                  <AIAvatar size={7} />
                  <div className="px-4 py-3.5 rounded-3xl rounded-tl-md flex items-center gap-1"
                    style={{ background: "rgba(255,255,255,0.03)" }}>
                    {[0, 1, 2].map(k => (
                      <motion.div key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.18 }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Erreur de connexion. Réessaie dans un moment.
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-2" />
          </div>
        </div>
      </div>

      {/* ─ Input area ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmitWithSave}>
            {/* Input container — the "pill" */}
            <div className="rounded-3xl transition-all duration-150"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${inputFocused || canSend ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.09)"}`,
                boxShadow: inputFocused ? "0 0 0 3px rgba(99,179,237,0.08), 0 8px 32px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.2)",
              }}>

              {/* Textarea */}
              <textarea ref={inputRef} value={input} onChange={handleTextareaChange} onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                placeholder="Pose ta question médicale…" rows={1} disabled={isLoading}
                className="w-full bg-transparent resize-none outline-none text-sm px-4 pt-3.5 pb-2"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  caretColor: "var(--accent)",
                  minHeight: "48px",
                  maxHeight: "180px",
                  lineHeight: "1.5",
                }} />

              {/* Bottom row: model picker + send */}
              <div className="flex items-center justify-between px-3 pb-2.5">
                <ModelPicker models={fetchedModels} selected={selectedModel} onSelect={handleModelChange} loading={loadingModels} />

                <button type="submit" disabled={!canSend}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 flex-shrink-0"
                  style={{
                    background: canSend ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.06)",
                    boxShadow: canSend ? "0 2px 12px rgba(255,255,255,0.2)" : "none",
                    transform: canSend ? "scale(1)" : "scale(0.9)",
                  }}>
                  {isLoading
                    ? <motion.div className="w-3.5 h-3.5 rounded-sm" style={{ background: "#000" }}
                        animate={{ scale: [1, 0.7, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    : <Send className="w-3.5 h-3.5" style={{ color: canSend ? "#000" : "rgba(255,255,255,0.3)" }} />}
                </button>
              </div>
            </div>

            <p className="text-center text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.2)" }}>
              Enter envoyer · Shift+Enter nouvelle ligne
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
