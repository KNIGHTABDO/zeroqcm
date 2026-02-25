import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Tier config
const TIERS: Record<string, {
  label: string; primary: string; glow: string;
  badge: string; badgeBorder: string; ring: string; stars: number;
}> = {
  gold:   { label: "GOLD",   primary: "#FFD700", glow: "rgba(255,215,0,0.18)",  badge: "rgba(255,215,0,0.12)",  badgeBorder: "rgba(255,215,0,0.35)",  ring: "rgba(255,215,0,0.22)",  stars: 3 },
  silver: { label: "SILVER", primary: "#C0C0C0", glow: "rgba(192,192,192,0.16)",badge: "rgba(192,192,192,0.1)", badgeBorder: "rgba(192,192,192,0.3)", ring: "rgba(192,192,192,0.18)",stars: 2 },
  bronze: { label: "BRONZE", primary: "#CD7F32", glow: "rgba(205,127,50,0.16)", badge: "rgba(205,127,50,0.1)",  badgeBorder: "rgba(205,127,50,0.3)",  ring: "rgba(205,127,50,0.18)", stars: 1 },
};

function scoreTier(score: number): string {
  if (score >= 90) return "gold";
  if (score >= 80) return "silver";
  return "bronze";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const module   = searchParams.get("module") ?? "Module";
  const scoreRaw = parseInt(searchParams.get("score") ?? "75", 10);
  const name     = searchParams.get("name")   ?? "Étudiant";
  const date     = searchParams.get("date")   ?? new Date().toLocaleDateString("fr-FR");
  const tierKey  = searchParams.get("tier")   ?? scoreTier(scoreRaw);
  const t = TIERS[tierKey] ?? TIERS.bronze;
  const starsArr = Array.from({ length: t.stars });

  return new ImageResponse(
    (
      <div style={{
        width: "1200px", height: "630px",
        background: "linear-gradient(145deg, #080810 0%, #0d0d18 45%, #080810 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        {/* BG glow blobs */}
        <div style={{ position: "absolute", top: -120, right: -100, width: 500, height: 500,
          borderRadius: "50%", background: `radial-gradient(circle, ${t.glow} 0%, transparent 68%)`, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -100, left: -80, width: 380, height: 380,
          borderRadius: "50%", background: `radial-gradient(circle, ${t.glow} 0%, transparent 68%)`, display: "flex" }} />

        {/* Main card */}
        <div style={{
          width: "880px", border: `1px solid ${t.ring}`, borderRadius: "36px",
          background: "rgba(255,255,255,0.025)", display: "flex", flexDirection: "column",
          alignItems: "center", overflow: "hidden",
          boxShadow: `0 0 120px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}>
          {/* Top tier stripe */}
          <div style={{ width: "100%", height: "4px", display: "flex",
            background: `linear-gradient(90deg, transparent 0%, ${t.primary} 30%, ${t.primary} 70%, transparent 100%)` }} />

          <div style={{ width: "100%", padding: "52px 72px", display: "flex",
            flexDirection: "column", alignItems: "center" }}>

            {/* Header: brand + tier */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "36px" }}>
              <div style={{ width: "54px", height: "54px", borderRadius: "16px",
                background: t.badge, border: `1px solid ${t.badgeBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px" }}>
                🏆
              </div>
              <span style={{ fontSize: "22px", fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em" }}>ZEROQCM</span>
              <div style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.1)", display: "flex" }} />
              <div style={{ padding: "6px 16px", borderRadius: "100px",
                background: t.badge, border: `1px solid ${t.badgeBorder}`,
                display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", gap: "3px" }}>
                  {starsArr.map((_, i) => (
                    <span key={i} style={{ fontSize: "13px", color: t.primary }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: "12px", fontWeight: 700, color: t.primary, letterSpacing: "0.1em" }}>{t.label}</span>
              </div>
            </div>

            {/* Certificate label */}
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", margin: 0, marginBottom: "10px",
              textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>
              Certificat de Réussite
            </p>

            {/* Module name */}
            <h1 style={{ fontSize: "36px", fontWeight: 800, color: "rgba(255,255,255,0.93)",
              margin: 0, marginBottom: "32px", textAlign: "center", lineHeight: 1.2, maxWidth: "680px" }}>
              {module}
            </h1>

            {/* Score ring + recipient */}
            <div style={{ display: "flex", alignItems: "center", gap: "40px", marginBottom: "32px" }}>
              <div style={{ width: "120px", height: "120px", borderRadius: "50%",
                border: `3px solid ${t.primary}`, background: t.badge,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px ${t.glow}` }}>
                <span style={{ fontSize: "34px", fontWeight: 900, color: t.primary, lineHeight: 1 }}>{scoreRaw}%</span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "3px", letterSpacing: "0.06em" }}>SCORE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "3px", height: "30px", borderRadius: "4px", background: t.primary, display: "flex" }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Récipiendaire</span>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{name}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "3px", height: "30px", borderRadius: "4px", background: "rgba(255,255,255,0.12)", display: "flex" }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Délivré le</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{date}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", width: "100%" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)", display: "flex" }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em" }}>
                zeroqcm.me · FMPC Casablanca
              </span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)", display: "flex" }} />
            </div>
          </div>

          {/* Bottom tier stripe */}
          <div style={{ width: "100%", height: "4px", display: "flex",
            background: `linear-gradient(90deg, transparent 0%, ${t.primary} 30%, ${t.primary} 70%, transparent 100%)` }} />
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}