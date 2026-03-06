"use client";
import { useState, useEffect } from"react";
import { motion, AnimatePresence } from"framer-motion";
import { Bookmark, Loader2, BookOpen, ChevronRight, Search, Trash2, X, LogIn } from"lucide-react";
import Link from"next/link";
import { supabase } from"@/lib/supabase";
import { useAuth } from"@/components/auth/AuthProvider";

type BookmarkedQ = {
  id: string;
  question_id: string;
  created_at: string;
  questions: {
    id: string;
    texte: string;
    image_url: string | null;
    activities: {
      id: number;
      nom: string;
      modules: { id: number; nom: string } | null;
    } | null;
  };
};

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookmarks, setBookmarks] = useState<BookmarkedQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("bookmarks")
      .select(`
        id, question_id, created_at,
        questions (
          id, texte, image_url,
          activities (
            id, nom,
            modules ( id, nom )
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setBookmarks((data ?? []) as unknown as BookmarkedQ[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function removeBookmark(bookmarkId: string, questionId: string) {
    setRemoving(bookmarkId);
    await supabase.from("bookmarks").delete().eq("id", bookmarkId);
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
    setRemoving(null);
  }

  const filtered = bookmarks.filter(b =>
    !search ||
    b.questions?.texte?.toLowerCase().includes(search.toLowerCase()) ||
    b.questions?.activities?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    b.questions?.activities?.modules?.nom?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen" style={{ background:"var(--bg)", color:"var(--text)" }}>
      <div className="max-w-2xl mx-auto px-4">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-20 pt-6 pb-3" style={{ background:"var(--bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color:"var(--text)" }}>Favoris</h1>
              <p className="text-[13px] mt-0.5" style={{ color:"var(--text-muted)" }}>
                {loading ?"Chargement…" : `${bookmarks.length} question${bookmarks.length !== 1 ?"s" :""} sauvegardée${bookmarks.length !== 1 ?"s" :""}`}
              </p>
            </div>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background:"var(--surface-alt)", border:"1px solid var(--border)" }}
            >
              <Bookmark strokeWidth={1.5} className="w-5 h-5" style={{ color:"var(--text-secondary)" }} />
            </div>
          </div>

          {/* Search */}
          {bookmarks.length > 3 && (
            <motion.div
              animate={{
                borderColor: searchFocused ?"var(--border-strong)" :"var(--border)",
              }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
              style={{ background:"var(--surface-alt)", border:"1px solid var(--border)" }}
            >
              <Search strokeWidth={1.5} className="w-3.5 h-3.5 flex-shrink-0" style={{ color:"var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Rechercher dans les favoris…"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color:"var(--text)", caretColor:"var(--accent)" }}
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearch("")}
                    style={{ color:"var(--text-muted)" }}
                  >
                    <X strokeWidth={1.5} className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="pb-24 space-y-2 pt-2">

          {/* Loading */}
          {(loading || authLoading) && (
            <div className="flex items-center justify-center py-16">
              <Loader2 strokeWidth={1.5} className="w-5 h-5 animate-spin" style={{ color:"var(--text-muted)" }} />
            </div>
          )}

          {/* Not logged in */}
          {!authLoading && !user && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 space-y-4"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background:"var(--surface-alt)", border:"1px solid var(--border)" }}
              >
                <LogIn className="w-6 h-6" style={{ color:"var(--text-muted)" }} />
              </div>
              <div className="space-y-1">
                <p className="text-[15px] font-semibold" style={{ color:"var(--text)" }}>
                  Connecte-toi pour voir tes favoris
                </p>
                <p className="text-[13px]" style={{ color:"var(--text-muted)" }}>
                  Sauvegarde les questions difficiles pour les revoir plus tard.
                </p>
              </div>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{ background:"var(--accent)", color:"var(--bg)" }}
              >
                Se connecter
              </Link>
            </motion.div>
          )}

          {/* Empty state */}
          {!loading && !authLoading && user && bookmarks.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 space-y-4"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background:"var(--surface-alt)", border:"1px solid var(--border)" }}
              >
                <Bookmark strokeWidth={1.5} className="w-6 h-6" style={{ color:"var(--text-muted)" }} />
              </div>
              <div className="space-y-1">
                <p className="text-[15px] font-semibold" style={{ color:"var(--text)" }}>
                  Pas encore de favoris
                </p>
                <p className="text-[13px]" style={{ color:"var(--text-muted)" }}>
                  Appuie sur l&apos;icône marque-page pendant un quiz pour sauvegarder une question.
                </p>
              </div>
              <Link
                href="/semestres"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{ background:"var(--surface-alt)", color:"var(--text-secondary)", border:"1px solid var(--border)" }}
              >
                <BookOpen strokeWidth={1.5} className="w-4 h-4" />
                Commencer un quiz
              </Link>
            </motion.div>
          )}

          {/* Search no results */}
          {!loading && user && bookmarks.length > 0 && filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[14px]" style={{ color:"var(--text-muted)" }}>Aucun résultat pour &quot;{search}&quot;</p>
            </div>
          )}

          {/* Bookmark cards */}
          <AnimatePresence>
            {!loading && user && filtered.map((bm, i) => {
              const q = bm.questions;
              const activity = q?.activities;
              const module_ = activity?.modules;

              return (
                <motion.div
                  key={bm.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  layout
                >
                  <div
                    className="rounded-xl p-4 group relative"
                    style={{ background:"var(--surface)", border:"1px solid var(--border)" }}
                  >
                    {/* Module breadcrumb */}
                    {(module_ || activity) && (
                      <div className="flex items-center gap-1.5 mb-2.5">
                        {module_ && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate max-w-[120px]"
                            style={{ background:"var(--surface-active)", color:"var(--text-muted)" }}
                          >
                            {module_.nom}
                          </span>
                        )}
                        {activity && (
                          <>
                            <ChevronRight strokeWidth={1.5} className="w-3 h-3 flex-shrink-0" style={{ color:"var(--text-disabled)" }} />
                            <span
                              className="text-[10px] font-medium truncate max-w-[140px]"
                              style={{ color:"var(--text-muted)" }}
                            >
                              {activity.nom}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Question text */}
                    <p
                      className="text-[13px] leading-relaxed line-clamp-3"
                      style={{ color:"var(--text-secondary)" }}
                    >
                      {q?.texte ??"Question non disponible"}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop:"1px solid var(--border)" }}>
                      <span className="text-[11px]" style={{ color:"var(--text-disabled)" }}>
                        {new Date(bm.created_at).toLocaleDateString("fr-FR", { day:"numeric", month:"short" })}
                      </span>
                      <div className="flex items-center gap-2">
                        {activity?.id && (
                          <Link
                            href={`/quiz/${activity.id}`}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                            style={{
                              background:"var(--surface-alt)",
                              color:"var(--text-muted)",
                              border:"1px solid var(--border)",
                            }}
                          >
                            <BookOpen strokeWidth={1.5} className="w-3 h-3" />
                            Réviser
                          </Link>
                        )}
                        <button
                          onClick={() => removeBookmark(bm.id, bm.question_id)}
                          disabled={removing === bm.id}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ color:"var(--text-muted)" }}
                          title="Retirer des favoris"
                        >
                          {removing === bm.id
                            ? <Loader2 strokeWidth={1.5} className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
