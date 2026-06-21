import { Browser, BrowserContext, Page, chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export interface ScreenshotResult extends ToolResult {
  base64?: string;
  filepath?: string;
}

function requirePage(): Page {
  if (!page) throw new Error('Browser is not open. Call open_browser first.');
  return page;
}

export async function open_browser(headless = false): Promise<ToolResult> {
  try {
    browser = await chromium.launch({ headless, slowMo: 50 });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    page = await context.newPage();
    logger.success('Browser launched (Chromium, 1280×800)');
    return { success: true, message: 'Browser opened successfully' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`open_browser failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function navigate_to_url(url: string): Promise<ToolResult> {
  try {
    const p = requirePage();
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await p.waitForTimeout(1500);
    logger.success(`Navigated to ${url}`);
    return { success: true, message: `Navigated to ${url}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`navigate_to_url failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function take_screenshot(label = ''): Promise<ScreenshotResult> {
  try {
    const p = requirePage();
    const dir = process.env.SCREENSHOT_DIR ?? './screenshots';
    const absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });

    const filename = `screenshot_${Date.now()}${label ? `_${label}` : ''}.png`;
    const filepath = path.join(absDir, filename);

    await p.screenshot({ path: filepath, fullPage: false });
    const base64 = fs.readFileSync(filepath).toString('base64');

    logger.success(`Screenshot saved → ${filename}`);
    return { success: true, message: `Screenshot saved to ${filepath}`, base64, filepath };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`take_screenshot failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function click_on_screen(x: number, y: number): Promise<ToolResult> {
  try {
    const p = requirePage();
    await p.mouse.click(x, y);
    await p.waitForTimeout(300);
    logger.success(`Clicked at (${x}, ${y})`);
    return { success: true, message: `Clicked at (${x}, ${y})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`click_on_screen failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function double_click(x: number, y: number): Promise<ToolResult> {
  try {
    const p = requirePage();
    await p.mouse.dblclick(x, y);
    await p.waitForTimeout(300);
    logger.success(`Double-clicked at (${x}, ${y})`);
    return { success: true, message: `Double-clicked at (${x}, ${y})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`double_click failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function send_keys(text: string): Promise<ToolResult> {
  try {
    const p = requirePage();
    await p.keyboard.type(text, { delay: 60 });
    logger.success(`Typed: "${text}"`);
    return { success: true, message: `Typed text: "${text}"` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`send_keys failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function press_key(key: string): Promise<ToolResult> {
  try {
    const p = requirePage();
    await p.keyboard.press(key);
    await p.waitForTimeout(200);
    logger.success(`Pressed key: ${key}`);
    return { success: true, message: `Pressed key: ${key}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`press_key failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function scroll(direction: 'up' | 'down', amount = 400): Promise<ToolResult> {
  try {
    const p = requirePage();
    const delta = direction === 'down' ? amount : -amount;
    // Move to viewport center first so wheel events land on the page content
    await p.mouse.move(640, 400);
    await p.mouse.wheel(0, delta);
    await p.waitForTimeout(600);
    logger.success(`Scrolled ${direction} by ${amount}px`);
    return { success: true, message: `Scrolled ${direction} by ${amount}px` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`scroll failed: ${msg}`);
    return { success: false, message: msg };
  }
}

export async function close_browser(): Promise<ToolResult> {
  try {
    if (browser) {
      await browser.close();
      browser = null;
      context = null;
      page = null;
      logger.success('Browser closed');
    }
    return { success: true, message: 'Browser closed' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}
