# Website Automation Agent

An intelligent web automation agent that autonomously navigates websites and performs tasks using **Playwright** for browser control and **Groq / Google Gemini** for visual reasoning and decision-making.

## What It Does

You describe a task in plain English — the agent figures out which website to visit, how to interact with it, and completes the task autonomously. It *sees* the page through screenshots and *reasons* about what to click, just like a human would.

**Example tasks:**
- `Play a lofi hip hop video on YouTube`
- `Fill out the contact form on example.com`
- `Search for TypeScript tutorials on Google and open the first result`
- `Navigate to ui.shadcn.com and fill the Name and Description form fields`

---

## Tech Stack

| Layer            | Technology                          |
|------------------|-------------------------------------|
| Language         | TypeScript                          |
| Browser Control  | Playwright (Chromium)               |
| Primary AI       | Groq — Llama 4 Scout (Vision)       |
| Fallback AI      | Google Gemini 2.0 Flash Lite        |
| Runtime          | Node.js 18+                         |

---

## Project Structure

```
website-automation-agent/
├── src/
│   ├── index.ts            # Entry point — prompts for task, calls runAgent()
│   ├── agent.ts            # Core agent loop (LLM ↔ browser)
│   ├── browser.ts          # Browser tool implementations (Playwright)
│   ├── tools.ts            # Tool declarations for Gemini and Groq
│   ├── llm.ts              # Shared LLM types and interfaces
│   ├── logger.ts           # Coloured terminal logging
│   └── providers/
│       ├── groq.ts         # Groq provider (primary, vision-capable)
│       └── gemini.ts       # Gemini provider (fallback)
├── screenshots/            # Auto-created; stores all captured screenshots
├── .env                    # Your API keys (not committed)
├── .env.example            # Template — copy to .env
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Groq API key** — [console.groq.com/keys](https://console.groq.com/keys) (free)
- **Google Gemini API key** *(optional fallback)* — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 1 — Install dependencies

```bash
npm install
```

### 2 — Install Playwright's Chromium browser

```bash
npm run install:browsers
```

### 3 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and set your keys:

```env
GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here   # optional fallback
HEADLESS=false                         # set true to run without a visible window
MAX_ITERATIONS=25                      # safety cap on agent steps
SCREENSHOT_DIR=./screenshots
```

### 4 — Run the agent

```bash
npm run dev
```

You will be prompted to enter a task:

```
What should the agent do? > Play a lofi hip hop video on YouTube
```

---

## How It Works

```
┌──────────────┐        screenshot        ┌───────────────────┐
│   Playwright │ ◄──────────────────────  │                   │
│   (Chromium) │                          │   Agent Loop      │
│              │ ────── tool calls ──────► │   (agent.ts)      │
└──────────────┘                          │                   │
                                          └────────┬──────────┘
                                                   │  image + history
                                          ┌────────▼──────────┐
                                          │  Groq Llama 4      │
                                          │  Scout (Vision)    │
                                          │  function calling  │
                                          └───────────────────┘
```

### Agent Loop

1. User enters a task in plain English
2. Agent builds a conversation history with the task description
3. Calls Groq (or Gemini as fallback) with tool declarations
4. LLM responds with a `functionCall` (e.g. `click_on_screen`, `send_keys`)
5. Tool is executed via Playwright; screenshots are attached as images
6. LLM *sees* the screenshot and decides the next action
7. Repeat until `task_complete` is called or the iteration limit is reached

### Available Tools

| Tool              | What it does                                  |
|-------------------|-----------------------------------------------|
| `open_browser`    | Launch Chromium with Playwright               |
| `navigate_to_url` | Go to a URL, wait for DOM load                |
| `take_screenshot` | Capture viewport PNG, send to LLM as image   |
| `click_on_screen` | Single mouse click at (x, y)                 |
| `double_click`    | Double-click at (x, y)                        |
| `send_keys`       | Type text into the focused element            |
| `press_key`       | Press a special key (Tab, Enter, etc.)        |
| `scroll`          | Scroll page up/down by N pixels               |
| `task_complete`   | Signals the agent to stop and close browser   |

---

## Configuration Reference

| Variable         | Default         | Description                              |
|------------------|-----------------|------------------------------------------|
| `GROQ_API_KEY`   | *(required)*    | Your Groq API key                        |
| `GEMINI_API_KEY` | *(optional)*    | Fallback if Groq fails                   |
| `HEADLESS`       | `false`         | Run browser without a UI window          |
| `MAX_ITERATIONS` | `25`            | Max agent steps before forced stop       |
| `SCREENSHOT_DIR` | `./screenshots` | Directory where screenshots are saved    |

---

## Example Output

```
────────────────────────────────────────────────────────────
[INFO]    Website Automation Agent
[INFO]    Tech: TypeScript + Playwright + Groq / Gemini
────────────────────────────────────────────────────────────
What should the agent do? > Play a lofi hip hop video on YouTube
────────────────────────────────────────────────────────────
[AGENT]   Providers: Groq/llama-4-scout → Gemini/gemini-2.0-flash-lite
[AGENT]   Max iterations: 25
[AGENT]   Task: Play a lofi hip hop video on YouTube
────────────────────────────────────────────────────────────
[STEP]    #1 Calling LLM...
[TOOL]    open_browser
[SUCCESS] Browser launched (Chromium, 1280×800)
[STEP]    #2 Calling LLM...
[TOOL]    navigate_to_url → {"url":"https://www.youtube.com"}
[SUCCESS] Navigated to https://www.youtube.com
[TOOL]    take_screenshot
[SUCCESS] Screenshot saved → screenshot_123.png
...
[SUCCESS] Task completed!
```

---

## Troubleshooting

**`GROQ_API_KEY is not set`** — Make sure `.env` exists and contains your key.

**Model decommissioned error** — Update `GROQ_MODEL` in `src/providers/groq.ts` to a current model from [console.groq.com/docs/models](https://console.groq.com/docs/models).

**Gemini quota exceeded** — Gemini is only a fallback. Generate a fresh key from a different Google account or rely on Groq alone.

**Form / element not found** — Set `HEADLESS=false` and watch the browser to debug visually. Check `screenshots/` to trace each step.

**Rate limit errors** — Groq free tier has RPM limits. Wait 60s and retry.
