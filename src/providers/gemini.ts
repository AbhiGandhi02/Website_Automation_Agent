import { GoogleGenAI, type Content, type Part } from '@google/genai';
import type { LLMProvider, LLMResponse, HistoryEntry, ToolCall } from '../llm';
import { toGeminiFunctions } from '../tools';
import { logger } from '../logger';

const GEMINI_MODEL = 'gemini-2.0-flash-lite';

let callCounter = 0;
function nextId(): string {
  return `call_${++callCounter}`;
}

function buildContents(history: HistoryEntry[]): Content[] {
  const contents: Content[] = [];

  for (const entry of history) {
    if (entry.kind === 'user_init') {
      contents.push({ role: 'user', parts: [{ text: entry.text }] });
      continue;
    }

    // Model turn — function calls
    if (entry.calls.length > 0) {
      contents.push({
        role: 'model',
        parts: entry.calls.map(c => ({
          functionCall: { name: c.name, args: c.args },
        })),
      });
    }

    // User turn — function responses + screenshot
    const userParts: Part[] = entry.results.map(r => ({
      functionResponse: { name: r.name, response: r.result },
    }));

    if (entry.screenshotBase64) {
      userParts.push({ text: 'Current browser state (viewport screenshot):' });
      userParts.push({ inlineData: { mimeType: 'image/png', data: entry.screenshotBase64 } });
    }

    if (userParts.length > 0) {
      contents.push({ role: 'user', parts: userParts });
    }
  }

  return contents;
}

export class GeminiProvider implements LLMProvider {
  name = `Gemini/${GEMINI_MODEL}`;
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete(history: HistoryEntry[], systemPrompt: string): Promise<LLMResponse> {
    const contents = buildContents(history);
    logger.info(`[Gemini] Sending ${contents.length} content turns`);

    const response = await this.ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        tools: [{ functionDeclarations: toGeminiFunctions() }],
        systemInstruction: systemPrompt,
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content) throw new Error('Gemini returned empty response');

    const parts: Part[] = candidate.content.parts ?? [];

    const toolCalls: ToolCall[] = parts
      .filter(p => p.functionCall?.name)
      .map(p => ({
        id: nextId(),
        name: p.functionCall!.name!,
        args: (p.functionCall!.args as Record<string, unknown>) ?? {},
      }));

    const text = parts.find(p => p.text)?.text;
    return { toolCalls, text };
  }
}
