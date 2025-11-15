import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";

app.use(cors());
app.use(express.json());

// Serve static files from the root directory for Replit
app.use(express.static(__dirname));

// Rate limiting simple implementation
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

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

app.post("/generate", async (req, res) => {
  const { animals } = req.body;
  const clientIp = req.ip || req.connection.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      error: "Too many requests. Please wait a moment before trying again."
    });
  }

  // Input validation
  if (!animals || !Array.isArray(animals) || animals.length === 0) {
    return res.status(400).json({ error: "Please provide at least one organism" });
  }

  if (animals.length > 20) {
    return res.status(400).json({ error: "Maximum 20 organisms allowed" });
  }

  // Sanitize input
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
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
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
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response structure from AI");
    }

    let content = data.choices[0].message.content.trim();

    // Remove markdown code blocks
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    // Extract JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", content);
      throw new Error("AI did not return valid JSON");
    }

    const jsonText = jsonMatch[0];
    const foodWeb = JSON.parse(jsonText);

    // Validate response structure
    if (!foodWeb.nodes || !Array.isArray(foodWeb.nodes) || foodWeb.nodes.length === 0) {
      throw new Error("Invalid nodes in AI response");
    }

    if (!foodWeb.edges || !Array.isArray(foodWeb.edges)) {
      throw new Error("Invalid edges in AI response");
    }

    // Validate all edges reference valid nodes
    const nodeSet = new Set(foodWeb.nodes);
    const validEdges = foodWeb.edges.filter(edge => {
      return edge.from && edge.to &&
             nodeSet.has(edge.from) &&
             nodeSet.has(edge.to) &&
             edge.from !== edge.to;
    });

    // Ensure all requested organisms are included
    const missingAnimals = sanitizedAnimals.filter(a => !nodeSet.has(a));
    if (missingAnimals.length > 0) {
      console.warn("AI omitted organisms:", missingAnimals);
    }

    const finalWeb = {
      nodes: foodWeb.nodes,
      edges: validEdges
    };

    console.log(`✅ Generated food web with ${finalWeb.nodes.length} nodes and ${finalWeb.edges.length} edges`);
    res.json(finalWeb);

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
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Clean up rate limit map every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of requestCounts.entries()) {
    const recent = requests.filter(time => now - time < RATE_WINDOW);
    if (recent.length === 0) {
      requestCounts.delete(ip);
    } else {
      requestCounts.set(ip, recent);
    }
  }
}, 600000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/generate`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Replit URL will be available in the Webview tab`);
});