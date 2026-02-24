"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Sparkles,
  User,
  Loader2,
  Trash2,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ALLOWED_MODELS, DEFAULT_MODEL } from "@/lib/github-models";

// ── Inline Markdown renderer (no extra deps) ─────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { result.push(<br key={i} />); i++; continue; }
    if (line.startsWith("### ")) {
      result.push(<p key={i} className="font-bold text-sm mt-3 mb-1" style={{ color: "var(--accent)" }}>{inlineFormat(line.slice(4))}</p>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      result.push(<p key={i} className="font-semibold text-sm mt-3 mb-1" style={{ color: "var(--text)" }}>{inlineFormat(line.slice(3))}</p>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      result.push(<p key={i} className="font-bold text-base mt-3 mb-1" style={{ color: "var(--text)" }}>{inlineFormat(line.slice(2))}</p>);
      i++; continue;
    }
    if (line.match(/^[-*•] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•] /)) {
        items.push(<li key={i} className="ml-2">{inlineFormat(lines[i].slice(2))}</li>);
        i++;
      }
      result.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1.5 text-sm">{items}</ul>);
      continue;
    }
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={i} className="ml-2">{inlineFormat(lines[i].replace(/^\d+\. /, ""))}</li>);
        i++;
      }
      result.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-1.5 text-sm">{items}</ol>);
      continue;
    }
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      result.push(
        <pre key={`code-${i}`} className="rounded-lg px-3 py-2 my-2 text-xs overflow-x-auto" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)", border: "1px solid var(--border)" }}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++; continue;
    }
    result.push(<p key={i} className="text-sm leading-relaxed my-0.5">{inlineFormat(line)}</p>);
    i++;
  }
  return result;
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={j} className="font-semibold" style={{ color: "var(--text)" }}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={j}>{part.slice(1, -1)}</em>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={j} className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ background: "rgba(255,255,255,0.08)", color: "var(--accent)" }}>{part.slice(1, -1)}</code>;
        return <span key={j}>{part}</span>;
      })}
    </>
  );
}

// ── Model labels ──────────────────────────────────────────────────────────────
const MODEL_LABELS: Record<string, string> = {
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
  "Meta-Llama-3.1-70B-Instruct": "Llama 3.1 70B",
  "Meta-Llama-3.3-70B-Instruct": "Llama 3.3 70B",
  "Mistral-large-2411": "Mistral Large",
  "Mistral-small-3.1-24B-Instruct-2503": "Mistral Small",
  "DeepSeek-V3-0324": "DeepSeek V3",
};

// ── Suggestions ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Mécanisme d'action des IEC",
  "Causes d'hypercalcémie",
  "Formule de Cockcroft-Gault",
  "Angor stable vs instable",
  "Résistance aux antibiotiques",
  "Hémostase primaire",
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChatWithAI() {
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } =
    useChat({ api: "/api/chat", body: { model: selectedModel } });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Close model menu on outside click
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

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col w-full" style={{ height: "calc(100dvh - 4rem)" }}>
      {/* on lg: full viewport height since BottomNav is hidden */}
      <style>{`@media (min-width: 1024px) { .chat-root { height: 100dvh !important; } }`}</style>

      {/* ─ Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-3 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(99,179,237,0.10)", border: "1px solid rgba(99,179,237,0.22)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>Chat with AI</h1>
            <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>Tuteur médical · ZeroQCM</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model selector */}
          <div className="relative" ref={modelMenuRef}>
            <button onClick={() => setModelMenuOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <span className="hidden sm:inline max-w-[120px] truncate">{MODEL_LABELS[selectedModel] ?? selectedModel}</span>
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
                  {ALLOWED_MODELS.map((m) => (
                    <button key={m}
                      onClick={() => { setSelectedModel(m); setModelMenuOpen(false); }}
                      className="w-full text-left px-3.5 py-2.5 text-xs transition-colors"
                      style={{
                        color: selectedModel === m ? "var(--accent)" : "var(--text-secondary)",
                        background: selectedModel === m ? "var(--accent-subtle)" : "transparent",
                        fontWeight: selectedModel === m ? 600 : 400,
                      }}>
                      {MODEL_LABELS[m] ?? m}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Clear */}
          {!isEmpty && (
            <button onClick={() => setMessages([])}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
              title="Effacer">
              <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            </button>
          )}
        </div>
      </div>

      {/* ─ Messages ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 space-y-4">

          {/* Empty state */}
          <AnimatePresence>
            {isEmpty && (
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center pt-8 md:pt-16 pb-4 gap-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(99,179,237,0.08)", border: "1px solid rgba(99,179,237,0.18)" }}>
                    <Sparkles className="w-8 h-8" style={{ color: "var(--accent)" }} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold mb-1.5" style={{ color: "var(--text)" }}>
                      Comment puis-je t&apos;aider ?
                    </h2>
                    <p className="text-sm max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      Pose-moi n&apos;importe quelle question médicale — mécanismes, calculs, pièges, révision.
                    </p>
                  </div>
                </div>

                {/* Suggestion chips */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button key={i}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 * i, duration: 0.2 }}
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

          {/* Message bubbles */}
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div key={msg.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>

                {/* Avatar */}
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={msg.role === "user"
                    ? { background: "rgba(255,255,255,0.08)", border: "1px solid var(--border)" }
                    : { background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.22)" }}>
                  {msg.role === "user"
                    ? <User className="w-3.5 h-3.5" style={{ color: "var(--text-secondary)" }} />
                    : <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />}
                </div>

                {/* Bubble */}
                <div className={cn(
                    "max-w-[85%] md:max-w-[78%] px-4 py-3 rounded-2xl text-sm",
                    msg.role === "user" ? "rounded-tr-md" : "rounded-tl-md"
                  )}
                  style={msg.role === "user"
                    ? { background: "var(--surface-active)", border: "1px solid var(--border-strong)", color: "var(--text)" }
                    : { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}>
                  {msg.role === "assistant"
                    ? <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                    : <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          <AnimatePresence>
            {isLoading && (
              <motion.div key="typing"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-2.5 items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,179,237,0.12)", border: "1px solid rgba(99,179,237,0.22)" }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-md flex items-center gap-1.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  {[0, 1, 2].map((k) => (
                    <motion.div key={k} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "var(--text-muted)" }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: k * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: "var(--error-subtle)", border: "1px solid var(--error-border)", color: "var(--error)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Erreur de connexion. Réessaie dans un moment.
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─ Input bar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3">
          <form onSubmit={e => {
            handleSubmit(e);
            setTimeout(() => { if (inputRef.current) inputRef.current.style.height = "auto"; }, 0);
          }} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question médicale… (Entrée pour envoyer)"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
              style={{
                background: "var(--input-bg)",
                border: "1px solid var(--input-border)",
                color: "var(--input-text)",
                caretColor: "var(--accent)",
                minHeight: "48px",
                maxHeight: "160px",
              }}
              onFocus={e => e.currentTarget.style.borderColor = "var(--input-focus)"}
              onBlur={e => e.currentTarget.style.borderColor = "var(--input-border)"}
            />
            <button type="submit" disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
              style={{
                background: input.trim() && !isLoading ? "var(--btn-primary-bg)" : "var(--surface-alt)",
                color: input.trim() && !isLoading ? "var(--btn-primary-text)" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
          <p className="text-center text-[11px] mt-2" style={{ color: "var(--text-disabled)" }}>
            Shift+Entrée pour saut de ligne · Vérifier les réponses avec les cours officiels
          </p>
        </div>
      </div>
    </div>
  );
}
