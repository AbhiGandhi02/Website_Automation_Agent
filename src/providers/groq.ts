import Groq from 'groq-sdk';
import type { LLMProvider, LLMResponse, HistoryEntry, ToolCall } from '../llm';
import { toOpenAITools } from '../tools';
import { logger } from '../logger';

// llama-3.3-70b-versatile: most reliable Groq model for tool/function calling
const GROQ_MODEL = 'llama-3.3-70b-versatile';

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

    // llama-3.3-70b-versatile is text-only — pass a note so it knows a screenshot was taken.
    // The model uses its training knowledge of the target page to determine coordinates.
    if (entry.screenshotBase64) {
      messages.push({
        role: 'user',
        content:
          'Screenshot captured (1280×800px viewport). ' +
          'Use your knowledge of the target page layout to decide coordinates for the next action.',
      });
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
