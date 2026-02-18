# Hypothesis PDF Highlight Demo

A browser-based tool for viewing PDFs and creating/displaying highlight annotations via the [Hypothesis](https://web.hypothes.is/) API. Built with React, TypeScript, Vite, and [react-pdf](https://github.com/wojtekmaj/react-pdf).

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Hypothesis](https://hypothes.is/) account and API token

## Getting Started

1. **Clone the repo**

   ```sh
   git clone https://github.com/<your-username>/annotation-tester.git
   cd annotation-tester
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the project root:

   ```
   VITE_HYPOTHESIS_API_TOKEN=<your_hypothesis_api_token>
   ```

   You can generate a token at https://hypothes.is/settings/developer.

4. **Start the dev server**

   ```sh
   npm run dev
   ```

   The app will be available at `http://localhost:5173`.

## Project Structure

```
src/
  main.tsx              # App entry point
  App.tsx               # Root component — URL input, highlight creation, state management
  App.css               # App styles
  components/
    PDFViewer.tsx        # PDF rendering and highlight overlay logic
```

## Usage

1. Paste a publicly accessible, CORS-friendly PDF URL (e.g. from arxiv.org) and click **Load PDF**.
2. Type the exact text you want to highlight, pick a color, and click **Create Hypothesis highlight**.
3. The highlight appears on the PDF immediately and is persisted to Hypothesis.

## Available Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `npm run dev`     | Start the Vite dev server      |
| `npm run build`   | Type-check and build for prod  |
| `npm run preview` | Preview the production build   |
| `npm run lint`    | Run ESLint                     |

## Contributing

1. Fork the repo and create a feature branch from `main`.
2. Make your changes and verify they pass linting and type-checking:
   ```sh
   npm run lint
   npm run build
   ```
3. Open a pull request against `main`.
