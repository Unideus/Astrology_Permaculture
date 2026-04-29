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
- `OLLAMA_URL`: Ollama server URL. Defaults to `http://127.0.0.1:11434`.
- `OLLAMA_MODEL`: Ollama model name. Defaults to `deepseek-v4-flash`.
- `OLLAMA_TIMEOUT_MS`: AI generation timeout in milliseconds. Defaults to `120000`.
- `OLLAMA_API_KEY`: Optional bearer token for hosted Ollama-compatible APIs. Leave blank for local Ollama.

Copy `.env.example` to `.env` if you want to keep local values written down.
Environment variables set by your shell or VPS override `.env` values. This app does
not require OpenClaw. It talks directly to any Ollama-compatible HTTP API using
`OLLAMA_URL`.

## Local Ollama Setup

Install and start Ollama, then pull the model you want to use:

```sh
ollama serve
ollama pull deepseek-v4-flash
```

In a second terminal, start this app:

```sh
npm start
```

Check whether the app can see Ollama:

```text
http://localhost:3000/api/ollama/status
```

If you use a different local model, set it before starting the app.

On macOS/Linux:

```sh
OLLAMA_MODEL=deepseek-v4-pro npm start
```

On PowerShell:

```powershell
$env:OLLAMA_MODEL="deepseek-v4-pro"; npm start
```

If Ollama is not running, the app still generates a deterministic fallback plan.
AI-enhanced sections are only included when Ollama is reachable and the configured
model exists.

## Hostinger VPS Ollama Deployment Shape

The simplest VPS setup is:

- Run Ollama on the VPS bound to localhost only: `127.0.0.1:11434`.
- Run this Node app on the same VPS, usually behind Nginx or Hostinger's Node app proxy.
- Keep `OLLAMA_URL=http://127.0.0.1:11434`.
- Set `OLLAMA_MODEL` to the reasoning model you want the hosted API or VPS Ollama service to use.

Example server environment:

```sh
PORT=3000
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=deepseek-v4-flash
OLLAMA_TIMEOUT_MS=120000
OLLAMA_API_KEY=
```

Do not expose Ollama directly to the public internet unless you put authentication
and firewall rules in front of it. The public browser should only reach the Node app.

For a hosted API that requires a key, set `OLLAMA_API_KEY` in Hostinger's
environment settings or in your local `.env`. Do not put that key in `public/app.js`
or any browser-side file.

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
