async function generateFoodWeb() {
  const input = document.getElementById("animalInput").value.trim();
  if (!input) return alert("Please enter at least one organism!");

  const response = await fetch("/api/foodweb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animals: input })
  });

  const data = await response.json();
  drawFoodWeb(data);
}

function drawFoodWeb(relationships) {
  const nodes = [];
  const edges = [];
  const added = new Set();

  for (const consumer in relationships) {
    if (!added.has(consumer)) {
      nodes.push({ id: consumer, label: capitalize(consumer) });
      added.add(consumer);
    }

    relationships[consumer].forEach(prey => {
      if (!added.has(prey)) {
        nodes.push({ id: prey, label: capitalize(prey) });
        added.add(prey);
      }
      edges.push({ from: prey, to: consumer }); // food → consumer ✅ correct direction
    });
  }

  const container = document.getElementById("mynetwork");
  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  const options = {
    nodes: { shape: "box", color: "#90caf9", font: { size: 16 } },
    edges: { arrows: 'to', color: "#555", smooth: true },
    physics: { stabilization: true }
  };
  new vis.Network(container, data, options);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
