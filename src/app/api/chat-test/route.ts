import { NextRequest } from "next/server";
import { streamText } from "ai";
import { githubModels } from "@/lib/github-models";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const model = req.nextUrl.searchParams.get("model") ?? "openai/gpt-4o-mini";
  const errors: string[] = [];

  try {
    const result = await streamText({
      model: githubModels(model),
      messages: [{ role: "user", content: "Say: PONG" }],
      maxTokens: 10,
    });

    let text = "";
    for await (const chunk of result.textStream) {
      text += chunk;
      if (text.length > 20) break;
    }

    return Response.json({
      ok: true,
      model,
      response: text,
    });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return Response.json({
      ok: false,
      model,
      message: String(e?.message ?? err),
      cause: String(e?.cause ?? ""),
      status: e?.statusCode ?? e?.status ?? "",
      responseBody: String(e?.responseBody ?? e?.data ?? ""),
      rawError: String(err),
    }, { status: 502 });
  }
}
