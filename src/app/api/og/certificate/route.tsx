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
  const hd       = searchParams.get("hd") === "1";
  const S        = hd ? 2 : 1; // scale multiplier
  const t = TIERS[tierKey] ?? TIERS.bronze;
  const starsArr = Array.from({ length: t.stars });
  const W = 1200 * S;
  const H = 630 * S;

  return new ImageResponse(
    (
      <div style={{
        width: `${W}px`, height: `${H}px`,
        background: "linear-gradient(145deg, #080810 0%, #0d0d18 45%, #080810 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative", overflow: "hidden",
      }}>
        {/* BG glow blobs */}
        <div style={{ position: "absolute", top: -120*S, right: -100*S, width: 500*S, height: 500*S,
          borderRadius: "50%", background: `radial-gradient(circle, ${t.glow} 0%, transparent 68%)`, display: "flex" }} />
        <div style={{ position: "absolute", bottom: -100*S, left: -80*S, width: 380*S, height: 380*S,
          borderRadius: "50%", background: `radial-gradient(circle, ${t.glow} 0%, transparent 68%)`, display: "flex" }} />

        {/* Main card */}
        <div style={{
          width: `${880*S}px`, border: `${1*S}px solid ${t.ring}`, borderRadius: `${36*S}px`,
          background: "rgba(255,255,255,0.025)", display: "flex", flexDirection: "column",
          alignItems: "center", overflow: "hidden",
          boxShadow: `0 0 ${120*S}px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}>
          {/* Top tier stripe */}
          <div style={{ width: "100%", height: `${4*S}px`, display: "flex",
            background: `linear-gradient(90deg, transparent 0%, ${t.primary} 30%, ${t.primary} 70%, transparent 100%)` }} />

          <div style={{ width: "100%", padding: `${52*S}px ${72*S}px`, display: "flex",
            flexDirection: "column", alignItems: "center" }}>

            {/* Header: brand + tier */}
            <div style={{ display: "flex", alignItems: "center", gap: `${16*S}px`, marginBottom: `${36*S}px` }}>
              <div style={{ width: `${54*S}px`, height: `${54*S}px`, borderRadius: `${16*S}px`,
                background: t.badge, border: `1px solid ${t.badgeBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: `${30*S}px` }}>
                🏆
              </div>
              <span style={{ fontSize: `${22*S}px`, fontWeight: 800, color: "rgba(255,255,255,0.55)", letterSpacing: "0.18em" }}>ZEROQCM</span>
              <div style={{ width: `${1*S}px`, height: `${28*S}px`, background: "rgba(255,255,255,0.1)", display: "flex" }} />
              <div style={{ padding: `${6*S}px ${16*S}px`, borderRadius: "100px",
                background: t.badge, border: `1px solid ${t.badgeBorder}`,
                display: "flex", alignItems: "center", gap: `${8*S}px` }}>
                <div style={{ display: "flex", gap: `${3*S}px` }}>
                  {starsArr.map((_, i) => (
                    <span key={i} style={{ fontSize: `${13*S}px`, color: t.primary }}>★</span>
                  ))}
                </div>
                <span style={{ fontSize: `${12*S}px`, fontWeight: 700, color: t.primary, letterSpacing: "0.1em" }}>{t.label}</span>
              </div>
            </div>

            {/* Certificate label */}
            <p style={{ fontSize: `${12*S}px`, color: "rgba(255,255,255,0.35)", margin: 0, marginBottom: `${10*S}px`,
              textTransform: "uppercase", letterSpacing: "0.18em", fontWeight: 600 }}>
              Certificat de Réussite
            </p>

            {/* Module name */}
            <h1 style={{ fontSize: `${36*S}px`, fontWeight: 800, color: "rgba(255,255,255,0.93)",
              margin: 0, marginBottom: `${32*S}px`, textAlign: "center", lineHeight: 1.2, maxWidth: `${680*S}px` }}>
              {module}
            </h1>

            {/* Score ring + recipient */}
            <div style={{ display: "flex", alignItems: "center", gap: `${40*S}px`, marginBottom: `${32*S}px` }}>
              <div style={{ width: `${120*S}px`, height: `${120*S}px`, borderRadius: "50%",
                border: `${3*S}px solid ${t.primary}`, background: t.badge,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 ${32*S}px ${t.glow}` }}>
                <span style={{ fontSize: `${34*S}px`, fontWeight: 900, color: t.primary, lineHeight: 1 }}>{scoreRaw}%</span>
                <span style={{ fontSize: `${10*S}px`, color: "rgba(255,255,255,0.4)", marginTop: `${3*S}px`, letterSpacing: "0.06em" }}>SCORE</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: `${14*S}px` }}>
                <div style={{ display: "flex", alignItems: "center", gap: `${12*S}px` }}>
                  <div style={{ width: `${3*S}px`, height: `${30*S}px`, borderRadius: `${4*S}px`, background: t.primary, display: "flex" }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: `${10*S}px`, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Récipiendaire</span>
                    <span style={{ fontSize: `${20*S}px`, fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{name}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: `${12*S}px` }}>
                  <div style={{ width: `${3*S}px`, height: `${30*S}px`, borderRadius: `${4*S}px`, background: "rgba(255,255,255,0.12)", display: "flex" }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: `${10*S}px`, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Délivré le</span>
                    <span style={{ fontSize: `${14*S}px`, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{date}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: `${20*S}px`, width: "100%" }}>
              <div style={{ flex: 1, height: `${1*S}px`, background: "rgba(255,255,255,0.06)", display: "flex" }} />
              <span style={{ fontSize: `${11*S}px`, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em" }}>
                zeroqcm.me · FMPC Casablanca
              </span>
              <div style={{ flex: 1, height: `${1*S}px`, background: "rgba(255,255,255,0.06)", display: "flex" }} />
            </div>
          </div>

          {/* Bottom tier stripe */}
          <div style={{ width: "100%", height: `${4*S}px`, display: "flex",
            background: `linear-gradient(90deg, transparent 0%, ${t.primary} 30%, ${t.primary} 70%, transparent 100%)` }} />
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
