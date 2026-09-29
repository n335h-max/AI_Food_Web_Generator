const MAX_ORGANISMS = 20;

export function normalizeAnimals(input) {
  const values = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const animals = [...new Set(
    values
      .filter((value) => typeof value === "string")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, MAX_ORGANISMS);

  if (animals.length === 0) throw new TypeError("Please provide at least one organism.");
  return animals;
}

export function validateFoodWeb(value, allowedAnimals) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("The model response must be an object.");
  }

  const allowed = new Set(normalizeAnimals(allowedAnimals));
  const nodes = [...new Set(
    (Array.isArray(value.nodes) ? value.nodes : [])
      .filter((node) => typeof node === "string")
      .map((node) => node.trim().toLowerCase())
      .filter(Boolean),
  )];

  if (nodes.length === 0 || nodes.some((node) => !allowed.has(node))) {
    throw new TypeError("The food web can only include the requested organisms.");
  }

  const nodeSet = new Set(nodes);
  const edges = [];
  const seenEdges = new Set();
  for (const edge of Array.isArray(value.edges) ? value.edges : []) {
    if (!edge || typeof edge !== "object") continue;
    const from = typeof edge.from === "string" ? edge.from.trim().toLowerCase() : "";
    const to = typeof edge.to === "string" ? edge.to.trim().toLowerCase() : "";
    const key = `${from}\u0000${to}`;
    if (!from || !to || from === to || !nodeSet.has(from) || !nodeSet.has(to) || seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push({ from, to });
  }
  return { nodes, edges };
}

export function parseFoodWebResponse(raw, allowedAnimals) {
  if (typeof raw !== "string") throw new TypeError("The model response must be valid JSON.");
  const withoutFences = raw.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  const jsonStart = withoutFences.indexOf("{");
  const jsonEnd = withoutFences.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) throw new TypeError("The model response must be valid JSON.");

  let parsed;
  try {
    parsed = JSON.parse(withoutFences.slice(jsonStart, jsonEnd + 1));
  } catch {
    throw new TypeError("The model response must be valid JSON.");
  }
  return validateFoodWeb(parsed, allowedAnimals);
}

export function buildPrompt(animals) {
  return `Create a scientifically accurate food web using only these organisms: ${animals.join(", ")}.

Return only valid JSON in this exact shape:
{"nodes":["organism"],"edges":[{"from":"prey","to":"predator"}]}

Arrows point from prey to predator. Do not invent organisms or impossible relationships.`;
}

export async function generateFoodWeb({ animals, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("The OPENROUTER_API_KEY server variable is not configured.");
  const normalizedAnimals = normalizeAnimals(animals);
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an ecologist. Always return JSON only." },
        { role: "user", content: buildPrompt(normalizedAnimals) },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) throw new Error(`The model request failed with status ${response.status}.`);
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("The model returned no food web.");
  return parseFoodWebResponse(content, normalizedAnimals);
}
