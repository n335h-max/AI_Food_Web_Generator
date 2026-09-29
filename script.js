export async function requestFoodWeb(animals, fetchImpl = fetch) {
  const response = await fetchImpl("/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animals }),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Server error: ${response.status}`);
  return data;
}
