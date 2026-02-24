"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, User, Loader2, Trash2, ChevronDown, AlertCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_MODEL } from "@/lib/github-models";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import type { Message } from "ai/react";

// Model list cache only (ephemeral catalog data, not user data)

// ── Markdown renderer with full table support ────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { result.push(<div key={i} className="h-2" />); i++; continue; }

    if (line.startsWith("### ")) {
      result.push(<p key={i} className="font-semibold text-xs mt-3 mb-1 uppercase tracking-wide" style={{ color: "var(--accent)" }}>{inlineFormat(line.slice(4))}</p>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      result.push(<p key={i} className="font-bold text-sm mt-3 mb-1" style={{ color: "var(--text)" }}>{inlineFormat(line.slice(3))}</p>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      result.push(<p key={i} className="font-bold text-base mt-3 mb-1.5" style={{ color: "var(--text)" }}>{inlineFormat(line.slice(2))}</p>);
      i++; continue;
    }

    if (line.trim().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { tableLines.push(lines[i]); i++; }
      result.push(renderTable(tableLines, result.length));
      continue;
    }

    if (line.match(/^[-*•] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        items.push(<li key={i} className="ml-1 leading-snug">{inlineFormat(lines[i].slice(2))}</li>);
        i++;
      }
      result.push(<ul key={"ul-" + i} className="list-disc list-inside space-y-0.5 my-1.5 text-sm">{items}</ul>);
      continue;
    }

    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} className="ml-1 leading-snug">{inlineFormat(lines[i].replace(/^\d+\. /, ""))}</li>);
        i++;
      }
      result.push(<ol key={"ol-" + i} className="list-decimal list-inside space-y-0.5 my-1.5 text-sm">{items}</ol>);
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      result.push(
        <pre key={"code-" + i} className="rounded-lg px-3 py-2 my-2 text-xs overflow-x-auto" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", border: "1px solid var(--border)" }}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++; continue;
    }

    if (line.match(/^---+$/) || line.match(/^\*\*\*+$/)) {
      result.push(<hr key={i} className="my-2 border-0 border-t" style={{ borderColor: "var(--border)" }} />);
      i++; continue;
    }

    // Source link line (line is purely a markdown link) → render as full CTA block
    const soloLink = line.match(/^\[([^\]]+)\]\((\/quiz\/\d+)\)$/);
    if (soloLink) {
      const [, label, href] = soloLink;
      result.push(
        <a key={i} href={href}
          className="flex items-center gap-2 px-4 py-3 rounded-xl mt-2 mb-1 text-sm font-semibold transition-all group"
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

function renderTable(lines: string[], keyBase: number): React.ReactNode {
  const rows = lines
    .map(l => l.split("|").slice(1, -1).map(cell => cell.trim()))
    .filter(cells => !cells.every(c => /^[-:]+$/.test(c)));
  if (rows.length === 0) return null;
  const [header, ...body] = rows;
  return (
    <div key={"table-" + keyBase} className="my-2 overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)" }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ background: "rgba(99,179,237,0.08)" }}>
            {header.map((cell, j) => (
              <th key={j} className="px-3 py-2 text-left font-semibold border-b whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                {inlineFormat(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
                  {inlineFormat(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function inlineFormat(text: string): React.ReactNode {
  // Split on bold, italic, strikethrough, inline code, AND markdown links [text](url)
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
        // Markdown link: [label](href)
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          const [, label, href] = linkMatch;
          const isInternal = href.startsWith("/");
          return (
            <a key={j} href={href}
              target={isInternal ? "_self" : "_blank"}
              rel={isInternal ? undefined : "noopener noreferrer"}
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

function AIAvatar({ size = 7 }: { size?: number }) {
  const px = size * 4;
  return (
    <div className={"w-" + size + " h-" + size + " rounded-full flex-shrink-0 overflow-hidden"}
      style={{ border: "1px solid rgba(99,179,237,0.3)", boxShadow: "0 0 8px rgba(99,179,237,0.15)" }}>
      <Image src="/ai-avatar.jpg" alt="ZeroQCM AI" width={px} height={px}
        className="w-full h-full object-cover" unoptimized />
    </div>
  );
}

interface FetchedModel { id: string; name: string; publisher: string; supports_tools?: boolean; supports_vision?: boolean; }

function labelFor(m: FetchedModel | undefined, id: string): string {
  return m?.name ?? id;
}

const SUGGESTIONS = [
  "Mécanisme d'action des IEC",
  "Donne-moi 3 QCM sur l'HTA",
  "Formule de Cockcroft-Gault",
  "QCM sur les muscles squelettiques",
  "Résistance aux antibiotiques",
  "Quiz: hémostase primaire",
];

function ToolCallBadge() {
  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs w-fit mb-2"
      style={{ background: "rgba(99,179,237,0.08)", border: "1px solid rgba(99,179,237,0.18)", color: "var(--accent)" }}>
      <Search className="w-3 h-3 flex-shrink-0" />
      <span>Recherche dans la base ZeroQCM…</span>
    </div>
  );
}



// ── Main component ────────────────────────────────────────────────────────────
export default function ChatWithAI() {
  const { user, profile } = useAuth();
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const loadedMsgCountRef = useRef<number | null>(null); // tracks initial DB load count

  // ── Fetch models from /api/gh-models (with 1h localStorage cache) ──
  useEffect(() => {
    const CACHE_KEY = "zqcm-models-cache";
    const CACHE_TTL = 60 * 60 * 1000;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cache = JSON.parse(raw) as { ts: number; models: FetchedModel[] };
        if (Date.now() - cache.ts < CACHE_TTL && cache.models.length > 0) {
          setFetchedModels(cache.models);
          setLoadingModels(false);
          return;
        }
      }
    } catch { /* ignore */ }
    fetch("/api/gh-models")
      .then(r => r.json())
      .then((data: FetchedModel[]) => {
        setFetchedModels(data);
        try { localStorage.setItem("zqcm-models-cache", JSON.stringify({ ts: Date.now(), models: data })); } catch { /* ignore */ }
      })
      .catch(() => setFetchedModels([
        { id: "gpt-4o", name: "GPT-4o", publisher: "OpenAI" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", publisher: "OpenAI" },
        { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", publisher: "Meta" },
      ]))
      .finally(() => setLoadingModels(false));
  }, []);

  // ── Load model from profile (DB only) ──
  useEffect(() => {
    const fromProfile = (profile?.preferences as Record<string, string> | undefined)?.ai_model;
    setSelectedModel(fromProfile ?? DEFAULT_MODEL);
    setHydrated(true);
  }, [profile]);

  // ── Load messages from Supabase on mount ──────────────────────
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  useEffect(() => {
    if (!user) { setMessagesLoaded(true); return; }
    supabase
      .from("chat_messages")
      .select("id, role, content, tool_invocations, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(80)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setInitialMessages(data.map(r => ({
            id: r.id,
            role: r.role as Message["role"],
            content: r.content,
            toolInvocations: r.tool_invocations ?? undefined,
          })));
        }
        setMessagesLoaded(true);
      })
      .then(null, () => setMessagesLoaded(true));
  }, [user]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } =
    useChat({
      api: "/api/chat",
      body: { model: selectedModel },
      initialMessages: messagesLoaded ? initialMessages : [],
      key: messagesLoaded ? "loaded" : "loading",
    });

  // ── Persist new messages to Supabase ──────────────────────────
  const savedMsgIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hydrated || !user || !messagesLoaded) return;
    const unsaved = messages.filter(m => !savedMsgIds.current.has(m.id) && m.content);
    if (unsaved.length === 0) return;
    unsaved.forEach(m => savedMsgIds.current.add(m.id));
    Promise.resolve(
      supabase.from("chat_messages").upsert(
        unsaved.map(m => ({
          id: m.id,
          user_id: user.id,
          role: m.role,
          content: m.content,
          tool_invocations: (m as Message & { toolInvocations?: unknown }).toolInvocations ?? null,
        })),
        { onConflict: "id" }
      )
    ).catch(() => { /* non-blocking */ });
  }, [messages, hydrated, user, messagesLoaded]);

  // ── Sync model change to API body on re-render ─────────────────
  // (useChat body is passed dynamically, so selectedModel changes take effect on next send)

  // Record initial message count after DB load — skip scroll for initial load
  useEffect(() => {
    if (messagesLoaded && loadedMsgCountRef.current === null) {
      loadedMsgCountRef.current = messages.length;
    }
  }, [messagesLoaded, messages.length]);

  // Only scroll to bottom for NEW messages/AI responses, never on initial load
  useEffect(() => {
    if (loadedMsgCountRef.current === null) return; // Not initialized yet
    if (messages.length > loadedMsgCountRef.current || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node))
        setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent);
        setTimeout(() => { if (inputRef.current) inputRef.current.style.height = "auto"; }, 0);
      }
    }
  };

  const handleSuggestion = (s: string) => {
    handleInputChange({ target: { value: s } } as React.ChangeEvent<HTMLTextAreaElement>);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = useCallback(() => {
    setMessages([]);           // instant UI update — no refresh needed
    savedMsgIds.current.clear();
    loadedMsgCountRef.current = 0; // Reset scroll tracker after clear
    if (user) {
      Promise.resolve(
        supabase.from("chat_messages").delete().eq("user_id", user.id)
      ).catch(() => { /* non-blocking */ });
    }
  }, [setMessages, user]);

  const handleModelChange = (m: string) => {
    setSelectedModel(m);
    setModelMenuOpen(false);
    // Persist to profiles.preferences in DB
    if (user && profile) {
      const prefs = { ...(profile.preferences ?? {}), ai_model: m };
      Promise.resolve(
        supabase.from("profiles").update({ preferences: prefs }).eq("id", user.id)
      ).catch(() => { /* non-blocking */ });
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="chat-wrap flex flex-col" style={{ height: "calc(100dvh - 5rem)" }}>
      <style>{`@media (min-width: 1024px) { .chat-wrap { height: 100dvh !important; } }`}</style>

      {/* ─ Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2.5 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div className="flex items-center gap-2.5">
          <AIAvatar size={8} />
          <div>
            <h1 className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>Chat with AI</h1>
            <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>Tuteur médical · ZeroQCM</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={modelMenuRef}>
            <button onClick={() => setModelMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <span className="hidden sm:inline max-w-[140px] truncate">{labelFor(fetchedModels.find(m => m.id === selectedModel), selectedModel)}</span>
              <span className="sm:hidden">Modèle</span>
              <ChevronDown className={cn("w-3 h-3 flex-shrink-0 transition-transform duration-150", modelMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {modelMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 w-52 rounded-xl overflow-hidden z-50"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}>
                  {/* Search */}
                  <div className="px-2 pt-2 pb-1.5">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Rechercher…"
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none"
                      style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text)", caretColor: "var(--accent)" }}
                    />
                  </div>
                  {/* Model list */}
                  <div style={{ overflowY: "auto", maxHeight: "220px" }}>
                    {loadingModels
                      ? <div className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>Chargement…</div>
                      : fetchedModels
                          .filter(m => {
                            if (!modelSearch) return true;
                            const q = modelSearch.toLowerCase();
                            return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q) || m.publisher.toLowerCase().includes(q);
                          })
                          .map((m) => (
                            <button key={m.id} onClick={() => { handleModelChange(m.id); setModelSearch(""); }}
                              className="w-full text-left px-3.5 py-2 transition-colors"
                              style={{
                                color: selectedModel === m.id ? "var(--accent)" : "var(--text-secondary)",
                                background: selectedModel === m.id ? "var(--accent-subtle)" : "transparent",
                              }}>
                              <div className="text-xs font-medium">{m.name}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {m.publisher && <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{m.publisher}</span>}
                                {m.supports_tools && <span className="text-[9px] px-1 rounded" style={{ background: "rgba(99,179,237,0.12)", color: "var(--accent)" }}>tools</span>}
                                {m.supports_vision && <span className="text-[9px] px-1 rounded" style={{ background: "rgba(168,85,247,0.12)", color: "#a855f7" }}>vision</span>}
                              </div>
                            </button>
                          ))
                    }
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!isEmpty && (
            <button onClick={handleClear}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          )}
        </div>
      </div>

      {/* ─ Messages ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-3 md:px-6 py-3 space-y-3">

          <AnimatePresence>
            {isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center pt-6 pb-2 gap-4">
                <div className="flex flex-col items-center gap-2.5 text-center">
                  <AIAvatar size={14} />
                  <div>
                    <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text)" }}>
                      Comment puis-je t&apos;aider ?
                    </h2>
                    <p className="text-xs max-w-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Mécanismes · QCM · Calculs · Pièges · Révision
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s, idx) => (
                    <motion.button key={idx}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * idx, duration: 0.18 }}
                      onClick={() => handleSuggestion(s)}
                      className="text-left px-3 py-2.5 rounded-xl text-xs leading-snug transition-all"
                      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-strong)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                      {s}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>

                <div className="flex-shrink-0 mt-0.5">
                  {msg.role === "user"
                    ? <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--border)" }}>
                        <User className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                      </div>
                    : <AIAvatar size={7} />}
                </div>

                <div className="flex flex-col gap-1 max-w-[85%] md:max-w-[78%]">
                  {msg.role === "assistant" && (msg as Message & { toolInvocations?: {toolName: string}[] }).toolInvocations?.some(t => t.toolName === "searchQCM") && (
                    <ToolCallBadge />
                  )}

                  <div className={cn("px-3.5 py-2.5 rounded-2xl text-sm", msg.role === "user" ? "rounded-tr-md" : "rounded-tl-md")}
                    style={msg.role === "user"
                      ? { background: "var(--surface-active)", border: "1px solid var(--border-strong)", color: "var(--text)" }
                      : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    {msg.role === "assistant"
                      ? <div className="space-y-0.5 overflow-x-auto">{renderMarkdown(msg.content)}</div>
                      : <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isLoading && (
              <motion.div key="typing"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-2 items-center">
                <AIAvatar size={7} />
                <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-md flex items-center gap-1.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {[0, 1, 2].map(k => (
                    <motion.div key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-muted)" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm"
                style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)", color: "var(--error)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Erreur de connexion. Réessaie dans un moment.
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─ Input bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-3 md:px-6 py-2.5">
          <form onSubmit={e => {
            handleSubmit(e);
            setTimeout(() => { if (inputRef.current) inputRef.current.style.height = "auto"; }, 0);
          }} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question médicale…"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-2xl px-3.5 py-3 text-sm outline-none transition-colors"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--input-text)",
                caretColor: "var(--accent)",
                minHeight: "44px",
                maxHeight: "160px",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "var(--input-focus)"}
              onBlur={e => e.currentTarget.style.borderColor = "var(--input-border)"}
            />
            <button type="submit" disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-colors"
              style={{
                background: input.trim() && !isLoading ? "var(--btn-primary-bg)" : "var(--surface-alt)",
                color: input.trim() && !isLoading ? "var(--btn-primary-text)" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
          <p className="text-center text-[10px] mt-1.5" style={{ color: "var(--text-disabled)" }}>
            Enter pour envoyer · Shift+Enter saut de ligne · Vérifier avec les cours officiels
          </p>
        </div>
      </div>
    </div>
  );
}
