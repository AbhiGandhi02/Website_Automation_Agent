# Website Automation Agent

An intelligent web automation agent that autonomously navigates websites and fills forms using **Playwright** for browser control and **Google Gemini** for visual reasoning and decision-making.

## What It Does

The agent autonomously completes the following task without any hardcoded selectors:

1. Launches a Chromium browser
2. Navigates to `https://ui.shadcn.com/docs/forms/react-hook-form`
3. Scrolls to find the interactive form demo (Name + Description fields)
4. Fills the **Name** field with `"Alex Johnson"`
5. Fills the **Description** field with a custom message
6. Signals completion

The agent *sees* the page through screenshots and *reasons* about what to click using Gemini Vision — the same way a human would.

---

## Tech Stack

| Layer            | Technology               |
|------------------|--------------------------|
| Language         | TypeScript               |
| Browser Control  | Playwright (Chromium)    |
| AI Backend       | Google Gemini 2.0 Flash  |
| Runtime          | Node.js 18+              |

---

## Project Structure

```
website-automation-agent/
├── src/
│   ├── index.ts       # Entry point — loads env, calls runAgent()
│   ├── agent.ts       # Core agent loop (Gemini ↔ browser)
│   ├── browser.ts     # Browser tool implementations (Playwright)
│   ├── tools.ts       # Gemini function declarations / schema
│   └── logger.ts      # Coloured terminal logging
├── screenshots/       # Auto-created; stores all captured screenshots
├── .env               # Your API key (not committed)
├── .env.example       # Template — copy to .env
├── package.json
├── tsconfig.json
└── README.md
```

---

## Setup

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Google Gemini API key** — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (free tier works)

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

Open `.env` and set your API key:

```env
GEMINI_API_KEY=your_actual_key_here
HEADLESS=false          # set true to run without a visible window
MAX_ITERATIONS=25       # safety cap on agent steps
SCREENSHOT_DIR=./screenshots
```

### 4 — Run the agent

```bash
# Development (ts-node, no build step)
npm run dev

# Production (compile first, then run)
npm run build && npm start
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
                                                   │  contents[]
                                                   │  (history)
                                          ┌────────▼──────────┐
                                          │  Google Gemini     │
                                          │  2.0 Flash (Vision)│
                                          │  function calling  │
                                          └───────────────────┘
```

### Agent Loop (agent.ts)

1. Build a `contents[]` conversation history with a task description
2. Call `ai.models.generateContent()` with tool declarations
3. Gemini responds with a `functionCall` (e.g. `take_screenshot`, `click_on_screen`)
4. Execute the tool via Playwright
5. If the tool was `take_screenshot`, attach the PNG as an `inlineData` image in the next user turn
6. Gemini sees the screenshot and decides the next action
7. Repeat until `task_complete` is called or the iteration limit is reached

### Tool Implementations (browser.ts)

| Tool              | What it does                                  |
|-------------------|-----------------------------------------------|
| `open_browser`    | Launch Chromium with Playwright               |
| `navigate_to_url` | Go to a URL, wait for DOM load                |
| `take_screenshot` | Capture viewport PNG, return base64           |
| `click_on_screen` | Single mouse click at (x, y)                 |
| `double_click`    | Double-click at (x, y)                        |
| `send_keys`       | Type text into the focused element            |
| `press_key`       | Press a special key (Tab, Enter, etc.)        |
| `scroll`          | Scroll page up/down by N pixels               |
| `task_complete`   | Signals the agent to stop and close browser   |

---

## Configuration Reference

| Variable         | Default        | Description                              |
|------------------|----------------|------------------------------------------|
| `GEMINI_API_KEY` | *(required)*   | Your Google Gemini API key               |
| `HEADLESS`       | `false`        | Run browser without a UI window          |
| `MAX_ITERATIONS` | `25`           | Max agent steps before forced stop       |
| `SCREENSHOT_DIR` | `./screenshots`| Directory where screenshots are saved    |

---

## Example Output

```
──────────────────────────────────────────────────────────────
[INFO]    23:15:01 Website Automation Agent — Assignment 04
[INFO]    23:15:01 Tech: TypeScript + Playwright + Google Gemini
──────────────────────────────────────────────────────────────
[STEP]    23:15:01 #1 Calling Gemini...
[TOOL]    23:15:02 open_browser
[SUCCESS] 23:15:03 Browser launched (Chromium, 1280×800)
[STEP]    23:15:03 #2 Calling Gemini...
[TOOL]    23:15:04 navigate_to_url → {"url":"https://ui.shadcn.com/..."}
[SUCCESS] 23:15:06 Navigated to https://ui.shadcn.com/...
[TOOL]    23:15:06 take_screenshot
[SUCCESS] 23:15:07 Screenshot saved → screenshot_1718999707_...png
[STEP]    23:15:07 #3 Calling Gemini...
...
[SUCCESS] 23:15:45 Task completed! Summary: Filled Name with "Alex Johnson" ...
```

---

## Troubleshooting

**`GEMINI_API_KEY is not set`** — Make sure `.env` exists and contains your key.

**`Browser is not open`** — The agent always opens the browser first; this error means Gemini called a tool out of order. Increase `MAX_ITERATIONS` or check your API key quota.

**Form not found after scrolling** — The shadcn page may have changed layout. Set `HEADLESS=false` and watch the browser to debug visually.

**Rate limit errors** — Gemini free tier has RPM limits. Wait 60s and retry, or upgrade your plan.
