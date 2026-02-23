"use client";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{
        background: "linear-gradient(90deg, var(--skeleton-from) 0%, var(--skeleton-to) 50%, var(--skeleton-from) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
        borderRadius: "0.75rem",
      }}
    />
  );
}

export function ModuleCardSkeleton() {
  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
        </div>
        <Skeleton className="w-4 h-4 rounded flex-shrink-0" />
      </div>
    </div>
  );
}

export function ActivityCardSkeleton() {
  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-2.5 w-16 rounded-lg" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="w-4 h-4 rounded flex-shrink-0" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-2.5 w-24" />
    </div>
  );
}
