import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getFacultyColor(faculty: string): string {
  const map: Record<string, string> = {
    FMPC: "blue",
    FMPR: "emerald",
    FMPM: "violet",
    UM6SS: "amber",
    FMPDF: "rose",
  };
  return map[faculty] ?? "zinc";
}
