const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;

app.use(express.json());
app.use(express.static('public'));

app.post("/generate", async (req, res) => {
  const { animals } = req.body;

  if (!animals || !Array.isArray(animals) || animals.length === 0) {
    return res.status(400).json({ error: "Please provide organisms" });
  }

  const sanitized = animals
    .map(a => a.trim().toLowerCase())
    .filter(a => a.length > 0)
    .slice(0, 20);

  try {
    const prompt = `You are an expert ecologist and biologist. Create a scientifically accurate and realistic food web based on these organisms: ${sanitized.join(", ")}

CRITICAL REQUIREMENTS:
1. Use ONLY the organisms listed above - do not add any extras
2. Base relationships on real ecological science and biology
3. Arrows point FROM prey TO predator (direction of energy flow)
4. Include all trophic levels: producers → primary consumers → secondary consumers → tertiary consumers → apex predators
5. If any organism is omnivorous, show multiple feeding relationships
6. Ensure the web is connected - every organism should have at least one connection
7. Consider realistic predator-prey relationships based on size, habitat, and diet
8. Output ONLY valid JSON with absolutely no markdown, explanations, or extra text

Response format (THIS IS THE ONLY ACCEPTABLE OUTPUT):
{
  "nodes": ["organism1", "organism2", "organism3"],
  "edges": [
    {"from": "prey_species", "to": "predator_species"},
    {"from": "another_prey", "to": "another_predator"}
  ]
}

Example for [grass, rabbit, fox, hawk]:
{
  "nodes": ["grass", "rabbit", "fox", "hawk"],
  "edges": [
    {"from": "grass", "to": "rabbit"},
    {"from": "rabbit", "to": "fox"},
    {"from": "rabbit", "to": "hawk"},
    {"from": "fox", "to": "hawk"}
  ]
}

Now generate the food web with scientific accuracy:`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert ecologist who creates scientifically accurate food webs. Always output valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    content = content.replace(/```json|```/g, '').trim();
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const foodWeb = JSON.parse(jsonMatch[0]);

    const nodeSet = new Set(foodWeb.nodes);
    const validEdges = foodWeb.edges.filter(e => 
      e.from && e.to && nodeSet.has(e.from) && nodeSet.has(e.to)
    );

    res.json({ nodes: foodWeb.nodes, edges: validEdges });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
