# Permaculture Design Generator

Permaculture Design Generator is a local web app for creating site-aware permaculture design plans. It combines user inputs with plant, biodynamic, climate, and garden planning data to generate practical recommendations for a site.

## Prerequisites

- Node.js 18+

## Setup

Install dependencies:

```sh
npm install
```

Start the app:

```sh
npm start
```

Open the app at:

```text
http://localhost:3000
```

## Development

Run the app with automatic restarts during development:

```sh
npm run dev
```

## Optional Environment Variables

- `PORT`: Local server port. Defaults to `3000`.
- `ENABLE_AI_ENHANCEMENT`: Enables optional hosted/local AI polish. Defaults to `false`. Only the string `true` enables AI calls.
- `OLLAMA_URL`: Ollama-compatible server URL. Defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL`: Ollama model name. Defaults to `deepseek-v4-flash`.
- `OLLAMA_TIMEOUT_MS`: AI generation timeout in milliseconds. Defaults to `120000`.
- `OLLAMA_API_KEY`: Optional bearer token for hosted Ollama-compatible APIs.

Copy `.env.example` to `.env` if you want to keep local values written down.
Environment variables set by your shell or VPS override `.env` values. This app does
not require OpenClaw, Ollama, or hosted API access. By default, it uses the
rule-based generator only.

## Optional AI Enhancement

AI enhancement is optional polish. The app works without Ollama/API access and
continues to return the normal rule-based plan when AI is disabled or unavailable.

To enable hosted Ollama-compatible enhancement, set these values in your local
`.env` or in your server environment:

```env
ENABLE_AI_ENHANCEMENT=true
OLLAMA_URL=https://ollama.com
OLLAMA_MODEL=deepseek-v4-flash
OLLAMA_API_KEY=<your key>
```

Check whether the app can see Ollama:

```text
http://localhost:3000/api/ollama/status
```

Keep `.env` private and do not commit it.

## Hostinger VPS Deployment Shape

The simplest VPS setup is:

- Run this Node app behind Nginx or Hostinger's Node app proxy.
- Leave `ENABLE_AI_ENHANCEMENT=false` unless you want hosted/local AI polish.
- If using hosted Ollama-compatible AI, set `OLLAMA_URL`, `OLLAMA_MODEL`, and `OLLAMA_API_KEY` in the server environment.

Example server environment:

```env
PORT=3000
ENABLE_AI_ENHANCEMENT=false
OLLAMA_URL=https://ollama.com
OLLAMA_MODEL=deepseek-v4-flash
OLLAMA_TIMEOUT_MS=120000
OLLAMA_API_KEY=
```

Do not put API keys in `public/app.js` or any browser-side file. The public browser
should only reach the Node app.

## Local Saved Data

The `sites/` folder contains local saved site data. It is ignored by git so your local saved sites do not get committed by accident.

## Troubleshooting

If port `3000` is already busy, start the app on another port.

On macOS/Linux:

```sh
PORT=3001 npm start
```

On PowerShell:

```powershell
$env:PORT=3001; npm start
```
