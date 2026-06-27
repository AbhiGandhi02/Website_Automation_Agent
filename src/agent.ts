import * as browser from './browser';
import { logger } from './logger';
import type { LLMProvider, LLMResponse, HistoryEntry, ToolCall, ToolResult } from './llm';
import { GroqProvider } from './providers/groq';
import { GeminiProvider } from './providers/gemini';

function buildSystemPrompt(task: string): string {
  return `You are an autonomous web automation agent controlling a real Chromium browser via Playwright.

YOUR TASK: ${task}

RULES:
- Start by calling open_browser, then navigate_to_url to the appropriate website
- After EVERY action (navigate, click, type, scroll, key press) — call take_screenshot so you can see the result
- The viewport is 1280×800 pixels; coordinates start from top-left (0,0)
- If something is not visible, scroll down and take another screenshot
- If a click misses, try slightly different coordinates
- Call task_complete ONLY after you have successfully completed the task

WEB SEARCH PATTERN (use this when searching on any site):
1. Click the search bar (usually at the top of the page)
2. Call take_screenshot to confirm it is focused
3. Call send_keys to type the search query
4. Call press_key with "Enter" to submit
5. Call take_screenshot — wait for results to fully load before clicking anything
6. Click on the desired result

VIDEO PLAYBACK PATTERN:
1. Click a video thumbnail from the search results
2. Call take_screenshot — wait for the video page to fully load
3. The video player occupies the left portion of the screen. Click at the center of the video player area (approximately x=427, y=240) to start playback
4. Call take_screenshot to confirm the video is playing (you should see a progress bar at the bottom of the player)
5. Only call task_complete after you can see the video is actually playing`;
}

type ToolArgs = Record<string, unknown>;

async function executeTool(
  name: string,
  args: ToolArgs,
): Promise<{ result: Record<string, unknown>; screenshotBase64?: string }> {
  logger.tool(name, args);

  switch (name) {
    case 'open_browser': {
      const headless = process.env.HEADLESS === 'true';
      return { result: { ...await browser.open_browser(headless) } };
    }
    case 'navigate_to_url':
      return { result: { ...await browser.navigate_to_url(String(args.url)) } };

    case 'take_screenshot': {
      const sr = await browser.take_screenshot();
      return {
        result: { success: sr.success, message: sr.message, filepath: sr.filepath ?? '' },
        screenshotBase64: sr.base64,
      };
    }
    case 'click_on_screen':
      return { result: { ...await browser.click_on_screen(Number(args.x), Number(args.y)) } };

    case 'double_click':
      return { result: { ...await browser.double_click(Number(args.x), Number(args.y)) } };

    case 'send_keys':
      return { result: { ...await browser.send_keys(String(args.text)) } };

    case 'press_key':
      return { result: { ...await browser.press_key(String(args.key)) } };

    case 'scroll': {
      const dir = args.direction === 'up' ? 'up' : 'down';
      const amount = args.amount !== undefined ? Number(args.amount) : 400;
      return { result: { ...await browser.scroll(dir, amount) } };
    }
    case 'task_complete':
      return { result: { success: true, message: String(args.summary) } };

    default:
      return { result: { success: false, message: `Unknown tool: ${name}` } };
  }
}

async function callWithFallback(
  providers: LLMProvider[],
  history: HistoryEntry[],
  systemPrompt: string,
): Promise<LLMResponse> {
  let lastError: Error | undefined;

  for (const provider of providers) {
    try {
      const response = await provider.complete(history, systemPrompt);
      logger.info(`Provider used: ${provider.name}`);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`${provider.name} failed: ${msg.slice(0, 120)}`);
      lastError = err instanceof Error ? err : new Error(msg);

      if (providers.indexOf(provider) < providers.length - 1) {
        logger.warn('Falling back to next provider...');
      }
    }
  }

  throw lastError ?? new Error('All providers failed');
}

export async function runAgent(task: string): Promise<void> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!groqKey && !geminiKey) {
    throw new Error('At least one of GROQ_API_KEY or GEMINI_API_KEY must be set');
  }

  const providers: LLMProvider[] = [];
  if (groqKey) providers.push(new GroqProvider(groqKey));
  if (geminiKey) providers.push(new GeminiProvider(geminiKey));

  const maxIterations = parseInt(process.env.MAX_ITERATIONS ?? '25', 10);
  const systemPrompt = buildSystemPrompt(task);

  logger.divider();
  logger.agent(`Providers: ${providers.map(p => p.name).join(' → ')}`);
  logger.agent(`Max iterations: ${maxIterations}`);
  logger.agent(`Task: ${task}`);
  logger.divider();

  const history: HistoryEntry[] = [
    {
      kind: 'user_init',
      text: `Begin the task now: ${task}`,
    },
  ];

  let iteration = 0;
  let taskDone = false;

  while (!taskDone && iteration < maxIterations) {
    iteration++;
    logger.step(iteration, 'Calling LLM...');

    let response: LLMResponse;
    try {
      response = await callWithFallback(providers, history, systemPrompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`All providers failed: ${msg}`);
      break;
    }

    if (response.toolCalls.length === 0) {
      if (response.text) logger.agent(`LLM says: ${response.text}`);
      logger.warn('No tool calls returned — stopping');
      break;
    }

    const results: ToolResult[] = [];
    let screenshotBase64: string | undefined;

    for (const call of response.toolCalls) {
      if (!call.name) continue;

      const { result, screenshotBase64: ss } = await executeTool(call.name, call.args);
      results.push({ callId: call.id, name: call.name, result });
      if (ss) screenshotBase64 = ss;

      if (call.name === 'task_complete') {
        logger.divider();
        logger.success(`Task completed! Summary: ${result.message}`);
        taskDone = true;
        break;
      }
    }

    history.push({
      kind: 'turn',
      calls: response.toolCalls,
      results,
      screenshotBase64,
    });
  }

  if (!taskDone) {
    logger.warn(`Agent stopped after ${iteration} iterations without completing the task`);
  }

  await browser.close_browser();
}
