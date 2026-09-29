import { generateFoodWeb, normalizeAnimals } from "../food-web.js";

export default async function handler(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const foodWeb = await generateFoodWeb({
      animals: normalizeAnimals(body?.animals),
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    return new Response(JSON.stringify(foodWeb), { status: 200, headers });
  } catch (error) {
    const message = error instanceof TypeError ? error.message : "Failed to generate food web.";
    const status = error instanceof TypeError ? 400 : 502;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
}
