export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { status: 405, headers }
    );
  }

  try {
    const body = await req.json();
    const { animals } = body;

    if (!animals || !Array.isArray(animals) || animals.length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide at least one organism" }), 
        { status: 400, headers }
      );
    }

    const sanitizedAnimals = animals
      .filter(a => typeof a === 'string')
      .map(a => a.trim().toLowerCase())
      .filter(a => a.length > 0)
      .slice(0, 20);

    if (sanitizedAnimals.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid organisms provided" }), 
        { status: 400, headers }
      );
    }

    const prompt = `You are an expert ecologist and biologist. Create a scientifically accurate and realistic food web based on these organisms: ${sanitizedAnimals.join(", ")}

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
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
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

    return new Response(
      JSON.stringify({
        nodes: foodWeb.nodes,
        edges: validEdges
      }), 
      { status: 200, headers }
    );

  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate food web",
        details: err.message 
      }), 
      { status: 500, headers }
    );
  }
};
