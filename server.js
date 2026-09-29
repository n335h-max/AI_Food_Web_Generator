import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateFoodWeb, normalizeAnimals } from "./food-web.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.static("."));

app.post("/generate", async (req, res) => {
  try {
    const animals = normalizeAnimals(req.body?.animals);
    const foodWeb = await generateFoodWeb({ animals, apiKey: process.env.OPENROUTER_API_KEY });
    return res.json(foodWeb);
  } catch (error) {
    const message = error instanceof TypeError ? error.message : "Failed to generate food web.";
    const status = error instanceof TypeError ? 400 : 502;
    return res.status(status).json({ error: message });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`Food web server listening on port ${port}`));
}

export { app };
