"use client";
import { cn } from "@/lib/utils";

interface MarqueeProps {
  className?: string;
  speed?: number;
  children?: React.ReactNode;
}

export function Marquee({ className, speed = 28, children }: MarqueeProps) {
  // If no children, use default subjects list
  const defaultItems = [
    "Anatomie","Biochimie","Physiologie","Histologie","Embryologie",
    "Biologie Cellulaire","Génétique","Immunologie","Microbiologie",
    "Pharmacologie","Séméiologie","Neurologie","Cardiologie",
    "Pneumologie","Gastroentérologie","Rhumatologie","Dermatologie",
    "Gynécologie","Pédiatrie","Chirurgie",
  ];

  const hasChildren = !!children;

  return (
    <div className={cn("relative overflow-hidden w-full max-w-full", className)}
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
      }}>
      {hasChildren ? (
        // Children mode: render twice for seamless loop
        <div
          className="flex whitespace-nowrap will-change-transform"
          style={{ animation: `marquee ${speed}s linear infinite`, width: "max-content" }}>
          <div className="flex">{children}</div>
          <div className="flex">{children}</div>
        </div>
      ) : (
        <div
          className="flex gap-3 whitespace-nowrap will-change-transform"
          style={{ animation: `marquee ${speed}s linear infinite`, width: "max-content" }}>
          {[...defaultItems, ...defaultItems].map((name, i) => (
            <span key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border flex-shrink-0"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
                color: "var(--text-secondary)",
              }}>
              <span className="w-1 h-1 rounded-full bg-blue-500/60 flex-shrink-0" />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
