"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Loader2, BookmarkX, ArrowRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/lib/supabase";
import { RichText } from "@/components/ui/RichText";

interface BookmarkedQuestion {
  id: string;
  question_id: string;
  created_at: string;
  questions: {
    id: string;
    texte: string;
    activity_id: number;
    activities: { id: number; nom: string; modules: { nom: string } | null } | null;
  } | null;
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bookmarks, setBookmarks] = useState<BookmarkedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadBookmarks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadBookmarks() {
    setLoading(true);
    const { data } = await supabase
      .from("bookmarks")
      .select("id, question_id, created_at, questions(id, texte, activity_id, activities(id, nom, modules(nom)))")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBookmarks((data ?? []) as unknown as BookmarkedQuestion[]);
    setLoading(false);
  }

  async function removeBookmark(bookmarkId: string, questionId: string) {
    setRemoving(questionId);
    await supabase.from("bookmarks").delete().eq("id", bookmarkId);
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    setRemoving(null);
  }

  const filtered = bookmarks.filter(b =>
    !search || b.questions?.texte.toLowerCase().includes(search.toLowerCase()) ||
    b.questions?.activities?.nom.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center space-y-3">
          <Bookmark size={32} style={{ color: "var(--text-muted)", margin: "0 auto" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Connexion requise</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Connectez-vous pour voir vos favoris</p>
          <button onClick={() => router.push("/auth")}
            className="px-4 py-2 rounded-xl text-sm font-semibold mt-2"
            style={{ background: "var(--text)", color: "var(--bg)" }}>
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg)" }}>
      <div className="max-w-lg mx-auto px-4 pt-8 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Favoris</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {loading ? "Chargement…" : `${bookmarks.length} question${bookmarks.length !== 1 ? "s" : ""} sauvegardée${bookmarks.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Bookmark size={18} style={{ color: "var(--accent)" }} />
          </div>
        </div>

        {/* Search */}
        {bookmarks.length > 4 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" style={{ color: "var(--text-muted)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 space-y-3">
            <Bookmark size={40} style={{ color: "var(--border-strong)", margin: "0 auto" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {search ? "Aucun résultat" : "Aucun favori"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {search ? "Essayez un autre terme" : "Appuyez sur 🔖 pendant un quiz pour sauvegarder une question"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.03 }}
                  className="rounded-2xl border p-4 space-y-3"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  {/* Module badge */}
                  {b.questions?.activities && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md border"
                        style={{ background: "var(--surface-active)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                        {b.questions.activities.modules?.nom ?? b.questions.activities.nom}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {new Date(b.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  )}

                  {/* Question preview */}
                  <div className="line-clamp-3">
                    <RichText text={b.questions?.texte ?? ""} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => router.push(`/quiz/${b.questions?.activity_id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-alt)" }}
                    >
                      Réviser <ArrowRight size={12} />
                    </button>
                    <button
                      onClick={() => removeBookmark(b.id, b.question_id)}
                      disabled={removing === b.question_id}
                      className="p-2 rounded-xl border transition-all hover:border-red-500/30 hover:bg-red-500/5 disabled:opacity-50"
                      style={{ borderColor: "var(--border)" }}
                      title="Retirer des favoris"
                    >
                      {removing === b.question_id
                        ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                        : <BookmarkX size={14} style={{ color: "rgb(239,68,68)" }} />
                      }
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
