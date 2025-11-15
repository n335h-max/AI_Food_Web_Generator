export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { animals } = req.body;

  if (!animals || !Array.isArray(animals) || animals.length === 0) {
    return res.status(400).json({ error: "Please provide at least one organism" });
  }

  const sanitizedAnimals = animals
    .filter(a => typeof a === 'string')
    .map(a => a.trim().toLowerCase())
    .filter(a => a.length > 0)
    .slice(0, 20);

  if (sanitizedAnimals.length === 0) {
    return res.status(400).json({ error: "No valid organisms provided" });
  }

  try {
    const prompt = `Create a realistic food web JSON for these organisms: ${sanitizedAnimals.join(", ")}

Rules:
- Use ONLY these organisms
- Arrows from prey to predator
- Output ONLY valid JSON

Format:
{
  "nodes": ["organism1", "organism2"],
  "edges": [{"from": "prey", "to": "predator"}]
}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content.trim();
    
    // Clean markdown
    content = content.replace(/```json|```/g, '').trim();
    
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const foodWeb = JSON.parse(jsonMatch[0]);

    // Validate
    const nodeSet = new Set(foodWeb.nodes);
    const validEdges = foodWeb.edges.filter(e => 
      e.from && e.to && nodeSet.has(e.from) && nodeSet.has(e.to)
    );

    return res.status(200).json({
      nodes: foodWeb.nodes,
      edges: validEdges
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ 
      error: "Failed to generate food web",
      details: err.message 
    });
  }
}
