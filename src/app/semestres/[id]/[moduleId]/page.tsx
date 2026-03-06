"use client";
import { use, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ClipboardList, Dumbbell, ArrowLeft, Clock, Search, Target, CheckCircle } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ActivityCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

interface Activity {
  id: number; nom: string; type_activite: "exam" | "exercise"; total_questions: number; chapitre?: string;
}

type Progress = {
  activity_id: number;
  answered: number;
  correct: number;
};

function ModuleActivitiesPageInner({ params }: { params: Promise<{ id: string; moduleId: string }> }) {
  const { id: semId, moduleId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const modId = parseInt(moduleId);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [moduleName, setModuleName] = useState("");
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"exercise" | "exam">(() => {
    const t = searchParams.get("tab");
    return t === "exam" ? "exam" : "exercise";
  });

  function switchTab(t: "exercise" | "exam") {
    setTab(t);
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", t);
    router.replace(`/semestres/${semId}/${moduleId}?${p.toString()}`, { scroll: false });
  }
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [weakCount, setWeakCount] = useState<number | null>(null);
}