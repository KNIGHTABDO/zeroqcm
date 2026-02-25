import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const module = searchParams.get("module") ?? "Module";
  const score  = searchParams.get("score")  ?? "100";
  const name   = searchParams.get("name")   ?? "\u00c9tudiant";
  const date   = searchParams.get("date")   ?? new Date().toLocaleDateString("fr-FR");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px", height: "630px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #111118 50%, #0d0d12 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}>
        {/* Background decorative circles */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240,
          borderRadius: "50%", background: "radial-gradient(circle, rgba(99,179,237,0.05) 0%, transparent 70%)", display: "flex" }} />

        {/* Main card */}
        <div style={{
          width: "820px", padding: "56px 64px",
          border: "1px solid rgba(255,215,0,0.18)",
          borderRadius: "32px",
          background: "rgba(255,255,255,0.02)",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: "28px",
          boxShadow: "0 0 80px rgba(255,215,0,0.04)",
        }}>
          {/* Trophy + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "16px",
              background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "28px",
            }}>\U0001f3c6</div>
            <span style={{ fontSize: "20px", fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.15em" }}>
              ZEROQCM
            </span>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)", margin: 0, textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Certificat de r\u00e9ussite
            </p>
            <h1 style={{ fontSize: "38px", fontWeight: 800, color: "rgba(255,255,255,0.92)", margin: 0, textAlign: "center", lineHeight: 1.15 }}>
              {module}
            </h1>
          </div>

          {/* Score badge */}
          <div style={{
            padding: "14px 36px", borderRadius: "100px",
            background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.22)",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <span style={{ fontSize: "36px", fontWeight: 900, color: "#FFD700" }}>{score}%</span>
            <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", paddingTop: "2px" }}>de r\u00e9ussite</span>
          </div>

          {/* Recipient */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: 0 }}>D\u00e9cern\u00e9 \u00e0</p>
            <p style={{ fontSize: "24px", fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>{name}</p>
          </div>

          {/* Date + divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", width: "100%" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", margin: 0, flexShrink: 0 }}>{date}</p>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
