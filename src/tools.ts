import { Type, type FunctionDeclaration } from '@google/genai';

interface ParamDef {
  type: 'string' | 'number' | 'boolean';
  description: string;
  optional?: boolean;
}

interface ToolDef {
  name: string;
  description: string;
  params: Record<string, ParamDef>;
  required: string[];
}

const TOOL_DEFS: ToolDef[] = [
  {
    name: 'open_browser',
    description: 'Initialize and launch a Chromium browser instance. ALWAYS call this first.',
    params: {},
    required: [],
  },
  {
    name: 'navigate_to_url',
    description: 'Navigate the browser to a given URL and wait for the page to load.',
    params: {
      url: { type: 'string', description: 'Full URL including https://' },
    },
    required: ['url'],
  },
  {
    name: 'take_screenshot',
    description:
      'Capture the current viewport as a PNG. Always call after navigating or performing actions to see the current page state.',
    params: {},
    required: [],
  },
  {
    name: 'click_on_screen',
    description:
      'Single mouse click at pixel coordinates (x, y). Use coordinates from the most recent screenshot.',
    params: {
      x: { type: 'number', description: 'Horizontal pixel coordinate (0-1280)' },
      y: { type: 'number', description: 'Vertical pixel coordinate (0-800)' },
    },
    required: ['x', 'y'],
  },
  {
    name: 'double_click',
    description: 'Double-click at pixel coordinates (x, y) — useful for selecting all text in a field.',
    params: {
      x: { type: 'number', description: 'Horizontal pixel coordinate' },
      y: { type: 'number', description: 'Vertical pixel coordinate' },
    },
    required: ['x', 'y'],
  },
  {
    name: 'send_keys',
    description: 'Type the given text into the currently focused element.',
    params: {
      text: { type: 'string', description: 'The text to type' },
    },
    required: ['text'],
  },
  {
    name: 'press_key',
    description: 'Press a special keyboard key: Tab, Enter, Escape, Backspace, ArrowDown, etc.',
    params: {
      key: { type: 'string', description: 'Key name e.g. "Tab", "Enter", "Control+a"' },
    },
    required: ['key'],
  },
  {
    name: 'scroll',
    description: 'Scroll the page up or down to reveal off-screen content.',
    params: {
      direction: { type: 'string', description: '"up" or "down"' },
      amount: { type: 'number', description: 'Pixels to scroll (default 400)', optional: true },
    },
    required: ['direction'],
  },
  {
    name: 'task_complete',
    description:
      'Signal that the automation task is done. Call ONLY after both Name and Description fields have been filled.',
    params: {
      summary: { type: 'string', description: 'What was accomplished' },
    },
    required: ['summary'],
  },
];

const geminiTypeMap: Record<string, Type> = {
  string:  Type.STRING,
  number:  Type.NUMBER,
  boolean: Type.BOOLEAN,
};

/** Gemini function declarations */
export function toGeminiFunctions(): FunctionDeclaration[] {
  return TOOL_DEFS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        Object.entries(t.params).map(([k, v]) => [
          k,
          { type: geminiTypeMap[v.type], description: v.description },
        ]),
      ),
      required: t.required,
    },
  }));
}

/** OpenAI-compatible tool definitions (used by Groq) */
export function toOpenAITools(): object[] {
  return TOOL_DEFS.map(t => {
    const hasParams = Object.keys(t.params).length > 0;
    return {
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        // Omit parameters entirely for no-arg tools — empty schemas confuse some models
        ...(hasParams && {
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(t.params).map(([k, v]) => [
                k,
                { type: v.type, description: v.description },
              ]),
            ),
            required: t.required,
          },
        }),
      },
    };
  });
}
