// Unified types shared by all LLM providers

export interface ToolCall {
  id: string;                        // unique per call; required by Groq, ignored by Gemini
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  result: Record<string, unknown>;
}

// One "iteration" in the agent loop
export type HistoryEntry =
  | { kind: 'user_init'; text: string }
  | {
      kind: 'turn';
      calls: ToolCall[];             // what the model decided to do
      results: ToolResult[];         // results of each call
      screenshotBase64?: string;     // screenshot captured during this turn
    };

export interface LLMResponse {
  toolCalls: ToolCall[];
  text?: string;
}

export interface LLMProvider {
  name: string;
  complete(history: HistoryEntry[], systemPrompt: string): Promise<LLMResponse>;
}
