import fetch from "node-fetch";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Simple rate limiting with memory
const requestCounts = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = requestCounts.get(ip) || [];
  const recentRequests = userRequests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  requestCounts.set(ip, recentRequests);
  return true;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { animals } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ 
      error: "Too many requests. Please wait a moment before trying again." 
    });
  }

  if (!animals || !Array.isArray(animals) || animals.length === 0) {
    return res.status(400).json({ error: "Please provide at least one organism" });
  }

  if (animals.length > 20) {
    return res.status(400).json({ error: "Maximum 20 organisms allowed" });
  }

  const sanitizedAnimals = animals
    .filter(a => typeof a === 'string')
    .map(a => a.trim().toLowerCase())
    .filter(a => a.length > 0 && a.length < 50)
    .slice(0, 20);

  if (sanitizedAnimals.length === 0) {
    return res.status(400).json({ error: "No valid organisms provided" });
  }

  try {
    const prompt = `You are an expert ecologist. Create a realistic food web based ONLY on these organisms:
${sanitizedAnimals.join(", ")}

CRITICAL RULES:
1. Use ONLY the organisms from the list above - do not add any extras
2. Create realistic predator-prey relationships based on real ecology
3. Arrows point FROM prey TO predator (energy flow direction)
4. Connect producers → herbivores → carnivores → apex predators
5. Include omnivores connecting to multiple levels if applicable
6. Ensure the web is connected - no isolated organisms
7. Output ONLY valid JSON with no markdown, no explanations, no extra text

JSON format (THIS IS THE ONLY ACCEPTABLE OUTPUT):
{
  "nodes": ["organism1", "organism2", ...],
  "edges": [
    {"from": "prey", "to": "predator"},
    {"from": "prey2", "to": "predator"}
  ]
}

Example for [grass, rabbit, fox]:
{
  "nodes": ["grass", "rabbit", "fox"],
  "edges": [
    {"from": "grass", "to": "rabbit"},
    {"from": "rabbit", "to": "fox"}
  ]
}

Now create the food web:`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": req.headers.host || "https://vercel.app",
        "X-Title": "AI Food Web Generator"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response structure from AI");
    }

    let content = data.choices[0].message.content.trim();
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", content);
      throw new Error("AI did not return valid JSON");
    }

    const jsonText = jsonMatch[0];
    const foodWeb = JSON.parse(jsonText);

    if (!foodWeb.nodes || !Array.isArray(foodWeb.nodes) || foodWeb.nodes.length === 0) {
      throw new Error("Invalid nodes in AI response");
    }

    if (!foodWeb.edges || !Array.isArray(foodWeb.edges)) {
      throw new Error("Invalid edges in AI response");
    }

    const nodeSet = new Set(foodWeb.nodes);
    const validEdges = foodWeb.edges.filter(edge => {
      return edge.from && edge.to && 
             nodeSet.has(edge.from) && 
             nodeSet.has(edge.to) &&
             edge.from !== edge.to;
    });

    const finalWeb = {
      nodes: foodWeb.nodes,
      edges: validEdges
    };

    console.log(`✅ Generated food web with ${finalWeb.nodes.length} nodes and ${finalWeb.edges.length} edges`);
    res.status(200).json(finalWeb);

  } catch (err) {
    console.error("❌ Error:", err.message);
    
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: "Request timeout - please try again" });
    }
    
    if (err instanceof SyntaxError) {
      return res.status(500).json({ error: "Failed to parse AI response - please try again" });
    }

    res.status(500).json({ 
      error: "Failed to generate food web. Please try again with different organisms." 
    });
  }
}
