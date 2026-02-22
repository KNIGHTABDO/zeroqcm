"use client";
import { useState } from "react";

interface QuizImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

/**
 * QuizImage — safe image renderer for ZeroQCM question images.
 *
 * Handles:
 * 1. Railway.app CDN images → routed through /api/image-proxy to avoid CORS on mobile
 * 2. image_coords strings → not actual images, render as null
 * 3. Any URL → error fallback (hide broken img, show placeholder)
 * 4. Light/dark mode → CSS variable tokens for border + bg
 */
export function QuizImage({ src, alt = "Illustration", className = "" }: QuizImageProps) {
  const [errored, setErrored] = useState(false);

  // Not an actual image URL — skip silently
  if (!src || src.startsWith("image_coords")) return null;

  // Proxy Railway.app images through our Next.js route (CORS-safe on mobile)
  const isRailway = src.includes("railway.app");
  const displaySrc = isRailway
    ? `/api/image-proxy?url=${encodeURIComponent(src)}`
    : src;

  if (errored) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-xl py-6 w-full"
        style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}
      >
        <span className="text-2xl">🖼️</span>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Image non disponible</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      onError={() => setErrored(true)}
      className={`question-image rounded-xl w-full object-contain max-h-56 ${className}`}
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    />
  );
}
