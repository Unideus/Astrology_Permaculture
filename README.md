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
- `OLLAMA_MODEL`: Ollama model name. Defaults to `qwen2.5-coder:14b`.

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
