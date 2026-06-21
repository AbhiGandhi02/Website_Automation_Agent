# Viva Preparation — Website Automation Agent

## Part 1: Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        index.ts                             │
│              Entry point — loads .env, calls runAgent()     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        agent.ts                             │
│                     (Agent Loop)                            │
│                                                             │
│  history: Content[]  ─────────────────────────────────►     │
│  [user: "Start task"]                         Gemini API    │
│                                               gemini-2.0    │
│  ◄─── functionCall: open_browser()            -flash        │
│  ◄─── functionCall: navigate_to_url(url)                    │
│  ◄─── functionCall: take_screenshot()                       │
│  ─── functionResponse + inlineData(PNG) ──────────────►     │
│  ◄─── functionCall: scroll(down, 400)                       │
│  ◄─── functionCall: click_on_screen(x, y)                   │
│  ◄─── functionCall: send_keys("Alex Johnson")               │
│  ◄─── functionCall: task_complete(summary)                  │
└────────────────────────┬────────────────────────────────────┘
                         │ calls
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       browser.ts                            │
│              Playwright Tool Implementations                 │
│                                                             │
│   open_browser()     → chromium.launch()                    │
│   navigate_to_url()  → page.goto()                          │
│   take_screenshot()  → page.screenshot() → base64           │
│   click_on_screen()  → page.mouse.click(x, y)               │
│   double_click()     → page.mouse.dblclick(x, y)            │
│   send_keys()        → page.keyboard.type()                 │
│   press_key()        → page.keyboard.press()                │
│   scroll()           → page.mouse.wheel()                   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                       tools.ts                              │
│            Gemini Function Declarations (Schema)             │
│                                                             │
│   Defines name, description, and parameter schema for       │
│   each tool so Gemini knows when and how to call them.      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow (One Iteration)

```
Agent                          Gemini                       Browser
  │                               │                            │
  │── contents (history+task) ──► │                            │
  │                               │── functionCall ──────────► │
  │                               │   take_screenshot()        │
  │◄─────────────── PNG (base64) ─┼────────────────────────── │
  │── functionResponse + image ──► │                            │
  │                               │── functionCall ──────────► │
  │                               │   click_on_screen(640,450) │
  │◄─────────────── {success:true}─┼────────────────────────── │
  │── functionResponse ──────────► │                            │
  │                               │── functionCall ──────────► │
  │                               │   send_keys("Alex Johnson")│
  │                               ...                          │
  │                               │── task_complete() ────────►│
```

### Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Element detection | Coordinate-based (x,y from screenshot) | No DOM access needed — same as how a human interacts |
| Context passing | Multimodal history (`inlineData` images) | Gemini Vision sees the page state just like a human |
| Loop termination | `task_complete` tool + `MAX_ITERATIONS` guard | Clean signal + safety net against infinite loops |
| State persistence | `Content[]` history array | Gives Gemini full conversation context across steps |
| Headless mode | Configurable via `.env` | Easy to toggle for demos vs. CI |

---

## Part 2: Predicted Viva Questions & Model Answers

---

### Section A — Core Concepts

**Q1: What is a web automation agent and how is yours different from a simple Selenium/Playwright script?**

A regular script has hardcoded selectors like `page.click('#submit-button')`. It breaks the moment the page changes. My agent is AI-driven — it takes a screenshot, sends the image to Gemini Vision, and lets the model reason about *where* elements are based on what it *sees*, just like a human would. There are no hardcoded selectors at all.

---

**Q2: Walk me through what happens when you run `npm run dev`.**

1. `index.ts` loads `.env` and calls `runAgent()`
2. `agent.ts` initialises the Gemini client and builds an initial `contents[]` array with the task prompt
3. It calls `ai.models.generateContent()` — Gemini responds with its first function call (`open_browser`)
4. `executeTool()` maps that to `browser.open_browser()` → Playwright launches Chromium
5. The function response is added back to `contents[]`
6. Gemini sees the result and calls the next tool (`navigate_to_url`)
7. This loop continues: screenshot → reason → action → repeat
8. When Gemini has filled both fields it calls `task_complete` → loop exits, browser closes

---

**Q3: Why did you choose Gemini over GPT-4 or Claude?**

The assignment mentions Google's ecosystem, Gemini 2.0 Flash is fast and multimodal (vision + function calling in one call), the free tier is generous for development, and `@google/genai` provides a clean TypeScript SDK. Any frontier multimodal model would work — the architecture is model-agnostic.

---

**Q4: What is function calling / tool use?**

Function calling lets an LLM signal that it wants to call an external function rather than just returning text. You register a set of tools with their names, descriptions, and parameter schemas (in JSON Schema format). The model returns a structured `functionCall` object with the tool name and arguments. You execute the function and send back a `functionResponse`. This is how I give Gemini "hands" to control the browser.

---

**Q5: Why do you pass screenshots as `inlineData` instead of just telling Gemini what happened in text?**

Text like "I navigated to the page" doesn't tell Gemini *where* the form is or what the page looks like. By passing the actual PNG, Gemini can inspect pixel coordinates, read labels, detect scroll position, and estimate where to click — exactly like a human reading a screen. This is the multimodal capability that makes vision-based automation possible.

---

### Section B — Implementation Details

**Q6: How does the agent find the form without any CSS selectors?**

It relies on Gemini Vision. After navigation it takes a screenshot and asks Gemini to identify visible elements. Gemini recognises "Name" and "Description" labels from the image and returns approximate (x, y) coordinates to click. If the form isn't visible it calls `scroll(down)` and takes another screenshot.

---

**Q7: What does `MAX_ITERATIONS` protect against?**

It's a safety guardrail. If Gemini gets confused (e.g., keeps scrolling without finding the form) the while-loop would run forever. `MAX_ITERATIONS` caps the agent at N steps and exits cleanly, preventing infinite loops and runaway API costs.

---

**Q8: How is conversation history maintained?**

The `history: Content[]` array accumulates every exchange — user messages, model responses (including function calls), and function results. This entire history is passed to Gemini on every iteration so it has full context: it knows what it already tried, what worked, and what the page looked like at each step.

---

**Q9: What happens if `take_screenshot` fails?**

`browser.ts` wraps every tool in a try/catch. If the screenshot fails it returns `{ success: false, message: "..." }`. This gets sent back to Gemini as a `functionResponse`. Gemini reads the error message and can decide to retry or take an alternative approach. It won't crash the agent.

---

**Q10: Why is `HEADLESS=false` the default?**

For demos and debugging — you can physically watch the browser navigate and fill the form. In a CI/CD environment you'd set `HEADLESS=true`. The option is exposed via `.env` so no code change is needed.

---

**Q11: Why does `send_keys` use a `delay: 60` ms between characters?**

Some web frameworks (like React Hook Form with validation) debounce input events. Typing too fast can cause characters to be dropped or validation to trigger mid-word. A 60ms delay mimics natural human typing and ensures the input handler processes each keystroke correctly.

---

### Section C — Architecture & Design

**Q12: How would you extend this agent to handle multi-step forms or CAPTCHAs?**

- **Multi-step forms**: The agent already handles this — it loops, taking screenshots after each action, so it naturally follows wizard-style forms page by page.
- **CAPTCHAs**: You'd integrate a CAPTCHA-solving service (e.g., 2Captcha) as an additional tool, or detect the CAPTCHA in the screenshot and pause for human intervention.

---

**Q13: How is your agent architecture similar to Browser Use or similar tools?**

They share the same core loop: screenshot → LLM decision → browser action → repeat. Browser Use additionally extracts the DOM tree alongside the screenshot, giving the model structured element data. My agent relies purely on vision, which is simpler but slightly less precise. Both use tool/function calling to bridge the LLM and browser.

---

**Q14: What would you change to make this production-ready?**

- Add **structured logging** to a file (not just console)
- **Retry logic** with exponential backoff for transient API errors
- **DOM extraction** fallback (if vision fails, try selector-based click)
- **Rate limit handling** for Gemini API quotas
- **Test coverage** — unit tests for each tool, integration test for the full run
- **Docker container** for reproducible execution

---

**Q15: What is `dotenv` used for and why is it important?**

`dotenv` loads key-value pairs from a `.env` file into `process.env` at runtime. The API key lives in `.env` which is `.gitignore`-d — it never gets committed to source control. This is standard secrets management practice. The `.env.example` file serves as a template so others know what variables are needed without exposing actual values.

---

### Section D — Live Demo Checklist

Before your viva, verify:

- [ ] `.env` file exists with a valid `GEMINI_API_KEY`
- [ ] `npm install` completed without errors
- [ ] `npm run install:browsers` installed Chromium
- [ ] `npm run dev` runs and opens a browser window
- [ ] The agent fills both fields and prints `[SUCCESS] Task completed!`
- [ ] Screenshots folder contains PNGs from the run
- [ ] You can explain any line of code in `agent.ts` and `browser.ts`

---

### Quick Reference — Key Terms

| Term | Definition |
|------|-----------|
| Playwright | Microsoft's browser automation library — controls Chromium, Firefox, WebKit |
| Function Calling | LLM feature where the model returns structured tool-call requests instead of text |
| Multimodal | AI that processes multiple input types — here: text + images (screenshots) |
| `Content[]` history | The conversation array passed to Gemini; accumulates all turns |
| `inlineData` | Gemini API field for embedding base64-encoded images directly in a message part |
| `FunctionDeclaration` | Schema describing a tool's name, description, and parameter types for Gemini |
| headless | Running a browser without a visible UI window |
| `dotenv` | Node.js library that loads `.env` files into `process.env` |
