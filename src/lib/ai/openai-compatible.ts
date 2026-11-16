import type { AIProvider, AITool, ChatTurn, ToolCall } from './types';
import { ToolsNotSupportedError } from './types';

/**
 * Penyedia untuk API berformat OpenAI (/v1/chat/completions), misalnya server Qwen lokal
 * (vLLM, Ollama, LM Studio). Diatur lewat OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL.
 */

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async chat(params: {
    system: string;
    history: ChatTurn[];
    tools: AITool[];
    runTool: (call: ToolCall) => Promise<unknown>;
    maxToolRounds?: number;
  }): Promise<string> {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: params.system },
      ...params.history.map((turn) => ({ role: turn.role, content: turn.content }) as OpenAIMessage),
    ];
    const maxRounds = params.maxToolRounds ?? 5;

    for (let round = 0; round <= maxRounds; round++) {
      const tools = round < maxRounds ? params.tools : [];
      const message = await this.complete(messages, tools);
      const calls = message.tool_calls || [];

      if (!calls.length) {
        const text = (message.content || '').trim();
        return text || 'Maaf, saya belum bisa menjawab pertanyaan itu.';
      }

      messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: calls });
      for (const call of calls) {
        let result: unknown;
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          result = await params.runTool({ name: call.function.name, args });
        } catch (error) {
          result = { error: error instanceof Error ? error.message : 'Alat gagal dijalankan.' };
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    return 'Maaf, pertanyaan ini membutuhkan terlalu banyak langkah. Coba persempit pertanyaannya.';
  }

  private async complete(messages: OpenAIMessage[], tools: AITool[]): Promise<OpenAIMessage> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: 0.2,
      max_tokens: 1024,
    };
    if (tools.length) {
      body.tools = tools.map((tool) => ({ type: 'function', function: tool }));
      body.tool_choice = 'auto';
    }

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55_000),
      });
    } catch (error) {
      console.error('AI server unreachable:', error);
      throw new Error('Server AI tidak dapat dihubungi atau terlalu lama merespons.');
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`AI server error ${res.status}: ${detail.slice(0, 500)}`);
      // Server yang tidak mendukung tool calling (misalnya vLLM tanpa --enable-auto-tool-choice).
      if (tools.length && res.status === 400 && /tool/i.test(detail)) throw new ToolsNotSupportedError();
      if (res.status === 401 || res.status === 403) throw new Error('OPENAI_API_KEY ditolak oleh server AI.');
      if (res.status === 404) throw new Error('Server AI menjawab "Not Found". Periksa OPENAI_BASE_URL/OPENAI_MODEL atau pastikan model sedang berjalan.');
      throw new Error(`Server AI bermasalah (${res.status}). Coba lagi nanti.`);
    }

    const data = await res.json();
    const message = data?.choices?.[0]?.message as OpenAIMessage | undefined;
    if (!message) throw new Error('Server AI tidak mengembalikan jawaban.');
    return message;
  }
}
