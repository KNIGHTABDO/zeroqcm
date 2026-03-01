// @ts-nocheck
"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Square, SquarePen, Trash2, ChevronDown, AlertCircle, Search, Copy, Check, X, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Message } from "ai/react";

// ── Thinking model detection ─────────────────────────────────────────────────
function isThinkingCapable(modelId: string): boolean {
  return (
    modelId.startsWith("claude-") ||
    modelId === "gpt-5.1" ||
    modelId === "gpt-5-mini" ||
    modelId.startsWith("gpt-5.1-codex") ||
    modelId.startsWith("gemini-")
  );
}

// ── Provider brand colors ──────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#10a37f", Anthropic: "#d4a27f", Meta: "#60a5fa",
  Mistral: "#ff7000", Google: "#4285f4", DeepSeek: "#7c6af7",
  Microsoft: "#0078d4", xAI: "#e2e2e2", Cohere: "#39d3c3", AI21: "#ff6b6b", Other: "#888",
};
const PROVIDER_BG: Record<string, string> = {
  OpenAI: "rgba(16,163,127,0.12)", Anthropic: "rgba(212,162,127,0.12)", Meta: "rgba(96,165,250,0.12)",
  Mistral: "rgba(255,112,0,0.12)", Google: "rgba(66,133,244,0.12)", DeepSeek: "rgba(124,106,247,0.12)",
  Microsoft: "rgba(0,120,212,0.12)", xAI: "rgba(226,226,226,0.08)", Cohere: "rgba(57,211,195,0.12)",
  AI21: "rgba(255,107,107,0.12)", Other: "rgba(255,255,255,0.05)",
};

interface FetchedModel { id: string; name: string; publisher: string; tier?: string; is_default?: boolean; supports_thinking?: boolean; supports_vision?: boolean; }

// ── Markdown renderer ──────────────────────────────────────────────────────────
function stripToolCallJson(text: string): string {
  return text.replace(/^\s*\{[^}]*"query"[^}]*\}\s*\n?/, "").trimStart();
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g);
  return (<>
    {parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={j} className="font-semibold" style={{ color: "rgba(255,255,255,0.95)" }}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={j}>{part.slice(1, -1)}</em>;
      if (part.startsWith("~~") && part.endsWith("~~")) return <s key={j}>{part.slice(2, -2)}</s>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={j} className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(255,255,255,0.1)", color: "#7dd3fc", border: "1px solid rgba(255,255,255,0.08)" }}>{part.slice(1, -1)}</code>;
      const lm = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) return <a key={j} href={lm[2]} target={lm[2].startsWith("/") ? "_self" : "_blank"} rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "#7dd3fc" }}>{lm[1]}</a>;
      return <span key={j}>{part}</span>;
    })}
  </>);
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
        result.push(<div key={"t"+i} className="my-3 overflow-x-auto rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-xs border-collapse">
            <thead><tr style={{ background: "rgba(255,255,255,0.04)" }}>{header.map((cell,j) => <th key={j} className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap" style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.9)" }}>{inlineFormat(cell)}</th>)}</tr></thead>
            <tbody>{body.map((row,ri) => <tr key={ri} style={{ background: ri%2===0?"transparent":"rgba(255,255,255,0.015)" }}>{row.map((cell,ci) => <td key={ci} className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)" }}>{inlineFormat(cell)}</td>)}</tr>)}</tbody>
          </table>
        </div>);
      }
      continue;
    }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim(); i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++; } i++;
      result.push(<div key={"c"+i} className="my-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "#0d1117" }}>
        {lang && <div className="px-4 py-1.5 text-[10px] font-mono border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.03)" }}><span>{lang}</span></div>}
        <pre className="px-4 py-3 text-xs font-mono overflow-x-auto leading-relaxed" style={{ color: "#e2e8f0" }}>{code.join("\n")}</pre>
      </div>); continue;
    }
    const h3 = line.match(/^###\s+(.*)/); if (h3) { result.push(<h3 key={"h3"+i} className="text-sm font-bold mt-5 mb-2" style={{ color: "rgba(255,255,255,0.95)" }}>{inlineFormat(h3[1])}</h3>); i++; continue; }
    const h2 = line.match(/^##\s+(.*)/); if (h2) { result.push(<h2 key={"h2"+i} className="text-base font-bold mt-6 mb-2" style={{ color: "rgba(255,255,255,0.98)" }}>{inlineFormat(h2[1])}</h2>); i++; continue; }
    const h1 = line.match(/^#\s+(.*)/); if (h1) { result.push(<h1 key={"h1"+i} className="text-lg font-bold mt-6 mb-3" style={{ color: "#fff" }}>{inlineFormat(h1[1])}</h1>); i++; continue; }
    const bq = line.match(/^>\s+(.*)/); if (bq) { result.push(<blockquote key={"bq"+i} className="pl-4 border-l-2 my-2 italic text-sm" style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)" }}>{inlineFormat(bq[1])}</blockquote>); i++; continue; }
    if (/^[\-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-*]\s/.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      result.push(<ul key={"ul"+i} className="space-y-1.5 my-2 pl-0">{items.map((item,idx) => <li key={idx} className="flex gap-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}><span className="mt-2 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.4)" }} /><span>{inlineFormat(item)}</span></li>)}</ul>); continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []; let n = 0;
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; n++; }
      result.push(<ol key={"ol"+i} className="space-y-1.5 my-2 pl-0">{items.map((item,idx) => <li key={idx} className="flex gap-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}><span className="flex-shrink-0 text-xs font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.35)", minWidth: "1.2rem" }}>{idx+1}.</span><span>{inlineFormat(item)}</span></li>)}</ol>); continue;
    }
    if (/^---+$/.test(line.trim())) { result.push(<hr key={"hr"+i} className="my-4" style={{ borderColor: "rgba(255,255,255,0.07)" }} />); i++; continue; }
    if (line.trim() === "") { result.push(<div key={"br"+i} className="h-3" />); i++; continue; }
    result.push(<p key={"p"+i} className="text-sm leading-7" style={{ color: "rgba(255,255,255,0.83)" }}>{inlineFormat(line)}</p>); i++;
  }
  return result;
}

// ── AI Avatar (uses icon.png, not logo.png which doesn't exist) ────────────────
function AIAvatar({ size = 8 }: { size?: number }) {
  const px = size * 4;
  return (
    <div className="rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: px, height: px, background: "linear-gradient(135deg, #10a37f22 0%, #7c3aed22 100%)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <Image src="/icon.png" alt="Z" width={px * 0.65} height={px * 0.65} className="object-contain" />
    </div>
  );
}

// ── Model Picker ───────────────────────────────────────────────────────────────
function ModelPicker({ models, selected, onSelect, loading }: {
  models: FetchedModel[]; selected: string; onSelect: (id: string) => void; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 50); }, [open]);

  const current = models.find(m => m.id === selected) ?? { id: selected, name: selected, publisher: "AI", tier: "standard" };
  const pColor = PROVIDER_COLORS[current.publisher] ?? "#888";
  const pBg = PROVIDER_BG[current.publisher] ?? "rgba(255,255,255,0.05)";

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = models.filter(m => !search || m.name.toLowerCase().includes(q) || m.publisher.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
    const map = new Map<string, FetchedModel[]>();
    for (const m of filtered) { const g = map.get(m.publisher) ?? []; g.push(m); map.set(m.publisher, g); }
    return map;
  }, [models, search]);

  return (
    <div className="relative" ref={ref}>
      {/* BUG FIX: type="button" prevents form submission */}
      <button type="button" onClick={() => setOpen(v => !v)} disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 select-none"
        style={{
          background: open ? pBg : "rgba(255,255,255,0.05)",
          border: `1px solid ${open ? pColor + "35" : "rgba(255,255,255,0.09)"}`,
          color: "rgba(255,255,255,0.85)",
        }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: pColor }} />
        <span className="max-w-[130px] truncate">{loading ? "…" : current.name}</span>
        <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform duration-200", open && "rotate-180")}
          style={{ color: "rgba(255,255,255,0.35)" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl z-[70] overflow-hidden"
            style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)" }}>

            <div className="p-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <Search className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un modèle…" className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: "rgba(255,255,255,0.85)", caretColor: "#10a37f" }} />
                {search && <button type="button" onClick={() => setSearch("")}><X className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} /></button>}
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
              {loading ? (
                <div className="px-4 py-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Chargement…</div>
              ) : grouped.size === 0 ? (
                <div className="px-4 py-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Aucun modèle trouvé</div>
              ) : Array.from(grouped.entries()).map(([provider, ms]) => (
                <div key={provider}>
                  <div className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-widest flex items-center gap-1.5"
                    style={{ color: PROVIDER_COLORS[provider] ?? "rgba(255,255,255,0.3)" }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_COLORS[provider] ?? "rgba(255,255,255,0.3)" }} />
                    {provider}
                  </div>
                  {ms.map(m => (
                    <button type="button" key={m.id} onClick={() => { onSelect(m.id); setOpen(false); setSearch(""); }}
                      className="w-full text-left px-3 py-2.5 flex items-center justify-between transition-all group"
                      style={{ background: selected === m.id ? (PROVIDER_BG[provider] ?? "rgba(255,255,255,0.05)") : "transparent" }}
                      onMouseEnter={e => { if (selected !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { if (selected !== m.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: selected === m.id ? (PROVIDER_COLORS[provider] ?? "#10a37f") : "rgba(255,255,255,0.85)" }}>{m.name}</span>
                        {m.tier === "premium" && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.15)" }}>PRO</span>}
                        {m.is_default && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,163,127,0.1)", color: "#10a37f", border: "1px solid rgba(16,163,127,0.15)" }}>défaut</span>}
                      </div>
                      {selected === m.id && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: PROVIDER_COLORS[provider] ?? "#10a37f" }} />}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="px-3 py-2.5 border-t flex items-center gap-1.5 text-[10px]" style={{ borderColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.2)" }}>
              <Sparkles className="w-2.5 h-2.5" />
              {models.length} modèles · GitHub Copilot API
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 active:scale-90"
      title="Copier"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {copied ? <Check className="w-3 h-3" style={{ color: "#10a37f" }} /> : <Copy className="w-3 h-3" style={{ color: "rgba(255,255,255,0.35)" }} />}
    </button>
  );
}

// ── Suggestion chips ───────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "💊", text: "Mécanisme d\'action des IEC" },
  { icon: "❓", text: "Donne-moi 3 QCM sur l\'HTA" },
  { icon: "🧮", text: "Formule de Cockcroft-Gault" },
  { icon: "💪", text: "QCM sur les muscles squelettiques" },
  { icon: "🦠", text: "Résistance aux antibiotiques" },
  { icon: "🩸", text: "Quiz: hémostase primaire" },
];

// ── Typing dots ────────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0,1,2].map(k => (
        <motion.div key={k} className="w-1.5 h-1.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.35)" }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: k * 0.18, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ChatWithAIPage() {
  const { user, profile } = useAuth();
  const [selectedModel, setSelectedModel] = useState("gpt-4.1-mini");
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const savedMsgIds = useRef(new Set<string>());
  const loadedMsgCountRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Fetch admin-curated models — NO localStorage, always fresh ──
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

  // ── Sync selected model from profile preference ──
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
    body: { model: selectedModel, thinking: thinkingMode },
  });

  // Load history
  useEffect(() => {
    if (!user || loadedMsgCountRef.current > 0) return;
    supabase.from("chat_messages").select("id, role, content, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: true }).limit(60)
      .then(({ data }) => {
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Textarea auto-resize
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
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
    supabase.from("chat_messages").insert({ user_id: user.id, role: "user", content: userContent })
      .then(({ data }) => { if (data?.[0]?.id) savedMsgIds.current.add(data[0].id); });
  }, [input, isLoading, handleSubmit, user]);

  const handleClear = useCallback(() => {
    setMessages([]);
    savedMsgIds.current.clear();
    loadedMsgCountRef.current = 0;
    if (user) supabase.from("chat_messages").delete().eq("user_id", user.id);
  }, [setMessages, user]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    // Auto-enable thinking mode for capable models, disable for others
    const m = fetchedModels.find(f => f.id === modelId);
    const capable = isThinkingCapable(modelId);
    setThinkingMode(capable);
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
        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 220)}px`;
      }
    }, 30);
  };

  const isEmpty = messages.length === 0;
  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 5rem)", background: "#0a0a0a" }}>
      <style>{`
        @media (min-width: 1024px) { .chat-root-inner { height: 100dvh !important; } }
        .chat-scroll::-webkit-scrollbar { width: 3px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .msg-hover:hover .msg-act { opacity: 1 !important; }
      `}</style>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-14"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0a0a0a" }}>
        <div className="flex items-center gap-3">
          <AIAvatar size={8} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.92)" }}>ZeroQCM AI</div>
            <div className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.28)" }}>
              Tuteur médical · {loadingModels ? "…" : `${fetchedModels.length} modèles`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isEmpty && (
            <button type="button" onClick={handleClear} title="Effacer"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
            </button>
          )}
          <button type="button" onClick={() => { setMessages([]); savedMsgIds.current.clear(); loadedMsgCountRef.current = 0; }} title="Nouvelle conversation"
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"}>
            <SquarePen className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="chat-scroll flex-1 overflow-y-auto" ref={containerRef} style={{ background: "#0a0a0a" }}>
        <div className="max-w-[760px] mx-auto px-4 md:px-8 pb-4">

          <AnimatePresence>
            {isEmpty && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col items-center pt-14 pb-6 gap-10">

                {/* Glow + avatar */}
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-[60px] opacity-30"
                    style={{ background: "radial-gradient(circle, #10a37f, #7c3aed)", transform: "scale(3)" }} />
                  <AIAvatar size={18} />
                </div>

                <div className="text-center space-y-2 -mt-2">
                  <h2 className="text-2xl font-semibold" style={{ color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}>
                    Comment puis-je t&apos;aider ?
                  </h2>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.32)" }}>
                    Mécanismes · QCM · Calculs · Pièges · Révision
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {SUGGESTIONS.map((s, idx) => (
                    <motion.button type="button" key={idx}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * idx, duration: 0.22, ease: "easeOut" }}
                      onClick={() => handleSuggestion(s.text)}
                      className="text-left px-4 py-3 rounded-2xl text-xs leading-snug transition-all active:scale-97"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)" }}
                      onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.055)" })}
                      onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" })}>
                      <span className="mr-1.5">{s.icon}</span>{s.text}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6 pt-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const inv = (msg as Message & { toolInvocations?: { toolName: string; args?: { query?: string } }[] }).toolInvocations;
                const qcmCall = inv?.find(t => t.toolName === "searchQCM");

                return (
                  <motion.div key={msg.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={cn("flex gap-4", isUser ? "flex-row-reverse" : "flex-row")}>

                    <div className="flex-shrink-0 mt-0.5">
                      {isUser
                        ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold select-none"
                            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", color: "rgba(255,255,255,0.65)" }}>
                            {user?.email?.[0]?.toUpperCase() ?? "U"}
                          </div>
                        : <AIAvatar size={7} />}
                    </div>

                    <div className={cn("flex flex-col gap-1.5 min-w-0", isUser ? "items-end max-w-[80%]" : "items-start max-w-[88%]")}>
                      {!isUser && qcmCall && (
                        <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg text-xs w-fit"
                          style={{ background: "rgba(16,163,127,0.06)", border: "1px solid rgba(16,163,127,0.12)", color: "rgba(16,163,127,0.7)" }}>
                          <Search className="w-3 h-3" />
                          <span>Recherche{qcmCall.args?.query ? ` — ${qcmCall.args.query}` : "…"}</span>
                        </div>
                      )}

                      <div className={cn("relative group w-full msg-hover")}>
                        {isUser ? (
                          <div className="px-4 py-3 rounded-3xl rounded-tr-md text-sm leading-relaxed whitespace-pre-wrap select-text"
                            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.9)" }}>
                            {msg.content}
                          </div>
                        ) : (
                          <div className="text-sm py-0.5 select-text">
                            <div className="space-y-0.5">
                              {renderMarkdown(stripToolCallJson(msg.content))}
                            </div>
                          </div>
                        )}

                        <div className={cn("msg-act absolute -bottom-7 flex items-center gap-1 opacity-0 transition-opacity duration-150", isUser ? "right-0" : "left-0")}>
                          <CopyButton text={msg.content} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Typing */}
            <AnimatePresence>
              {isLoading && (
                <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }} className="flex gap-4 items-start">
                  <AIAvatar size={7} />
                  <div className="flex flex-col gap-1.5">
                    <div className="px-3.5 py-2.5 rounded-3xl rounded-tl-sm"
                      style={{ background: thinkingMode ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.04)", border: `1px solid ${thinkingMode ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.06)"}` }}>
                      {thinkingMode
                        ? <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 flex-shrink-0" style={{ color: "#a78bfa" }} />
                            <span className="text-xs" style={{ color: "rgba(139,92,246,0.8)" }}>En réflexion…</span>
                          </div>
                        : <TypingDots />}
                    </div>
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
                  Erreur de connexion. Vérifie les tokens AI dans l&apos;admin.
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} className="h-6" />
          </div>
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-[760px] mx-auto">
          <form onSubmit={handleSubmitWithSave}>
            <motion.div
              animate={{
                borderColor: inputFocused ? "rgba(255,255,255,0.18)" : canSend ? "rgba(255,255,255,0.11)" : "rgba(255,255,255,0.07)",
                boxShadow: inputFocused ? "0 0 0 4px rgba(16,163,127,0.05), 0 8px 40px rgba(0,0,0,0.5)" : "0 4px 24px rgba(0,0,0,0.3)",
              }}
              transition={{ duration: 0.18 }}
              className="rounded-3xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>

              <textarea
                ref={inputRef} value={input}
                onChange={handleTextareaChange} onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                placeholder="Pose ta question médicale…"
                rows={1} disabled={isLoading}
                className="w-full bg-transparent resize-none outline-none text-sm px-4 pt-4 pb-2 placeholder:text-white/20"
                style={{ color: "rgba(255,255,255,0.9)", caretColor: "#10a37f", minHeight: "56px", maxHeight: "220px", lineHeight: "1.6", WebkitAppearance: "none" }}
              />

              <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
                <ModelPicker models={fetchedModels} selected={selectedModel} onSelect={handleModelChange} loading={loadingModels} />

                {/* Thinking mode toggle — only for capable models */}
                {isThinkingCapable(selectedModel) && (
                  <button
                    type="button"
                    onClick={() => setThinkingMode(v => !v)}
                    title={thinkingMode ? "Désactiver le mode réflexion" : "Activer le mode réflexion"}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium transition-all active:scale-95 flex-shrink-0"
                    style={{
                      background: thinkingMode ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${thinkingMode ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                      color: thinkingMode ? "#a78bfa" : "rgba(255,255,255,0.35)",
                    }}>
                    <Zap className="w-3 h-3" style={{ fill: thinkingMode ? "#a78bfa" : "none" }} />
                    <span className="hidden sm:inline">{thinkingMode ? "Réflexion" : "Réflexion"}</span>
                  </button>
                )}

                <motion.button
                  type={isLoading ? "button" : "submit"}
                  onClick={isLoading ? () => stop() : undefined}
                  disabled={!isLoading && !canSend}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors active:scale-90"
                  animate={{
                    background: isLoading ? "rgba(239,68,68,0.12)" : canSend ? "#10a37f" : "rgba(255,255,255,0.05)",
                    scale: canSend || isLoading ? 1 : 0.85,
                  }}
                  transition={{ duration: 0.12 }}
                  style={{ border: isLoading ? "1px solid rgba(239,68,68,0.25)" : "none" }}>
                  {isLoading
                    ? <Square className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
                    : <ArrowUp className="w-4 h-4" style={{ color: canSend ? "#fff" : "rgba(255,255,255,0.2)" }} />}
                </motion.button>
              </div>
            </motion.div>
          </form>
        </div>
      </div>
    </div>
  );
}
