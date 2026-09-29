import assert from "node:assert/strict";
import test from "node:test";

import {
  generateFoodWeb,
  normalizeAnimals,
  parseFoodWebResponse,
  validateFoodWeb,
} from "./food-web.js";

test("normalizes organism input and caps it at twenty unique values", () => {
  const animals = normalizeAnimals(" Grass, rabbit, grass, fox ");

  assert.deepEqual(animals, ["grass", "rabbit", "fox"]);
  assert.throws(() => normalizeAnimals(""), /at least one organism/i);
});

test("parses fenced model JSON and removes invalid edges", () => {
  const result = parseFoodWebResponse(
    "```json\n{\"nodes\":[\"grass\",\"rabbit\",\"fox\"],\"edges\":[{\"from\":\"grass\",\"to\":\"rabbit\"},{\"from\":\"fox\",\"to\":\"unknown\"}]}\n```",
    ["grass", "rabbit", "fox"],
  );

  assert.deepEqual(result, {
    nodes: ["grass", "rabbit", "fox"],
    edges: [{ from: "grass", to: "rabbit" }],
  });
});

test("rejects malformed or out-of-scope food webs", () => {
  assert.throws(
    () => parseFoodWebResponse("not json", ["grass"]),
    /valid JSON/i,
  );
  assert.throws(
    () => validateFoodWeb({ nodes: ["grass", "rabbit"], edges: [] }, ["grass"]),
    /only include/i,
  );
});

test("keeps the model request and response contract stable", async () => {
  let request;
  const result = await generateFoodWeb({
    animals: "grass, rabbit",
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"nodes":["grass","rabbit"],"edges":[{"from":"grass","to":"rabbit"}]}' } }],
        }),
      };
    },
  });

  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.deepEqual(JSON.parse(request.options.body).messages.at(-1).content.includes("grass, rabbit"), true);
  assert.deepEqual(result, {
    nodes: ["grass", "rabbit"],
    edges: [{ from: "grass", to: "rabbit" }],
  });
});
