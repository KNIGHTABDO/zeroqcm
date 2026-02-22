import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { prompt, model, key } = await req.json() as { prompt: string; model?: string; key?: string };

  const apiKey = key || process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    return new Response("Configurez une clé API dans les Paramètres.", { status: 200 });
  }

  const modelId = model?.includes("gpt") ? model : (model ?? "gemini-2.0-flash");
  const isGemini = !modelId.includes("gpt");

  try {
    if (isGemini) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
          }),
        }
      );

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const reader = res.body?.getReader();
          if (!reader) { controller.close(); return; }
          const dec = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
                  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) controller.enqueue(encoder.encode(text));
                } catch { /* skip malformed */ }
              }
            }
          }
          controller.close();
        },
      });

      return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }

    // OpenAI fallback
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelId,
        stream: true,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
      }),
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body?.getReader();
        if (!reader) { controller.close(); return; }
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const d = JSON.parse(line.slice(6)) as { choices?: { delta?: { content?: string } }[] };
                const t = d?.choices?.[0]?.delta?.content;
                if (t) controller.enqueue(encoder.encode(t));
              } catch { /* skip */ }
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (e) {
    return new Response("Erreur IA: " + String(e), { status: 200 });
  }
}
