import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  const token = process.env.GITHUB_MODELS_TOKEN ?? "";
  if (!token) {
    return NextResponse.json([
      { id: "gpt-4o-mini", name: "GPT-4o Mini", publisher: "OpenAI" },
      { id: "gpt-4o", name: "GPT-4o", publisher: "OpenAI" },
    ]);
  }

  try {
    const res = await fetch("https://models.inference.ai.azure.com/models", {
      headers: { Authorization: "Bearer " + token },
      next: { revalidate: 3600 }, // cache 1h
    });
    if (!res.ok) throw new Error("GitHub Models API error: " + res.status);
    const data = await res.json() as unknown[];
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([
      { id: "gpt-4o-mini", name: "GPT-4o Mini", publisher: "OpenAI" },
      { id: "gpt-4o", name: "GPT-4o", publisher: "OpenAI" },
      { id: "Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", publisher: "Meta" },
    ]);
  }
}
