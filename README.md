# AI Food Web Generator

An educational web app that turns a list of organisms into an interactive food web. The model is constrained to the organisms supplied by the user, and the server validates the returned graph before it reaches the browser.

## Demo

Open the [live demo](https://ai-food-web-generator.vercel.app/) or run the app locally.

## Local setup

```bash
npm install
copy .env.example .env
npm start
```

Set `OPENROUTER_API_KEY` in `.env`, then open `http://localhost:3000`.

## API

`POST /generate`

```json
{"animals":["grass","rabbit","fox"]}
```

The response is always:

```json
{"nodes":["grass","rabbit","fox"],"edges":[{"from":"grass","to":"rabbit"}]}
```

Edges point from prey to predator. Invalid model output, unknown organisms, duplicate edges, and self-loops are rejected or removed before the response is returned.

## Development

```bash
npm test
npm start
```

The browser sends requests to the same `/generate` contract used by the local Express server and the Netlify function.
