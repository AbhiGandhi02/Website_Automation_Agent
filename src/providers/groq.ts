import Groq from 'groq-sdk';
import type { LLMProvider, LLMResponse, HistoryEntry, ToolCall } from '../llm';
import { toOpenAITools } from '../tools';
import { logger } from '../logger';

// llama-4-scout: current Groq model with vision + tool/function calling support
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

type GroqMessage = Groq.Chat.ChatCompletionMessageParam;

function buildMessages(history: HistoryEntry[], systemPrompt: string): GroqMessage[] {
  const messages: GroqMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const entry of history) {
    if (entry.kind === 'user_init') {
      messages.push({ role: 'user', content: entry.text });
      continue;
    }

    // Assistant turn — the model's tool calls
    if (entry.calls.length > 0) {
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: entry.calls.map(c => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      });
    }

    // Tool results — one message per result
    for (const r of entry.results) {
      messages.push({
        role: 'tool',
        tool_call_id: r.callId,
        content: JSON.stringify(r.result),
      });
    }

    // Pass the actual screenshot as an image so the model can see the page
    if (entry.screenshotBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Current browser state (1280×800px viewport):' },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${entry.screenshotBase64}` },
          },
        ],
      } as GroqMessage);
    }
  }

  return messages;
}

export class GroqProvider implements LLMProvider {
  name = `Groq/${GROQ_MODEL}`;
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async complete(history: HistoryEntry[], systemPrompt: string): Promise<LLMResponse> {
    const messages = buildMessages(history, systemPrompt);
    logger.info(`[Groq] Sending ${messages.length} messages`);

    const response = await this.client.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      tools: toOpenAITools() as Groq.Chat.ChatCompletionTool[],
      tool_choice: 'auto',
      temperature: 0.1,
    });

    const msg = response.choices[0]?.message;
    if (!msg) throw new Error('Groq returned empty response');

    const toolCalls: ToolCall[] = (msg.tool_calls ?? []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      args: (() => {
        try { return JSON.parse(tc.function.arguments || '{}'); }
        catch { return {}; }
      })(),
    }));

    return { toolCalls, text: msg.content ?? undefined };
  }
}
