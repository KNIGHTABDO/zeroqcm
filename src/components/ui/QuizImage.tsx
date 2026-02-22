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
 * 1. Railway.app CDN images → routed through /api/image-proxy to avoid CORS
 * 2. image_coords strings → not actual images, render as null  
 * 3. Any URL → error fallback (hide + show broken icon)
 * 4. Light mode → subtle border + bg for visibility
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
        className={\`flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm \${className}\`}
        style={{
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <span>🖼️</span>
        <span>Image non disponible</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displaySrc}
      alt={alt}
      onError={() => setErrored(true)}
      className={\`question-image \${className}\`}
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    />
  );
}
