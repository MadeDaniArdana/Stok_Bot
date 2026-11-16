import type { AIProvider, AITool, ChatTurn, ToolCall } from './types';

/** Gemini lewat REST API (tanpa SDK). Model bisa diganti lewat GEMINI_MODEL. */
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  [key: string]: unknown; // misalnya thoughtSignature, harus dikirim balik apa adanya
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = DEFAULT_MODEL
  ) {}

  async chat(params: {
    system: string;
    history: ChatTurn[];
    tools: AITool[];
    runTool: (call: ToolCall) => Promise<unknown>;
    maxToolRounds?: number;
  }): Promise<string> {
    const contents: GeminiContent[] = params.history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }));
    const maxRounds = params.maxToolRounds ?? 5;

    for (let round = 0; round <= maxRounds; round++) {
      const content = await this.generate(params.system, contents, round < maxRounds ? params.tools : []);
      const calls = content.parts.filter((part) => part.functionCall);

      if (!calls.length) {
        const text = content.parts.map((part) => part.text || '').join('').trim();
        return text || 'Maaf, saya belum bisa menjawab pertanyaan itu.';
      }

      // Simpan giliran model persis seperti diterima, lalu kirim hasil setiap alat.
      contents.push(content);
      const responses: GeminiPart[] = [];
      for (const part of calls) {
        const call = part.functionCall!;
        let result: unknown;
        try {
          result = await params.runTool({ name: call.name, args: call.args || {} });
        } catch (error) {
          result = { error: error instanceof Error ? error.message : 'Alat gagal dijalankan.' };
        }
        responses.push({ functionResponse: { name: call.name, response: { result } } });
      }
      contents.push({ role: 'user', parts: responses });
    }

    return 'Maaf, pertanyaan ini membutuhkan terlalu banyak langkah. Coba persempit pertanyaannya.';
  }

  private async generate(system: string, contents: GeminiContent[], tools: AITool[]): Promise<GeminiContent> {
    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    };
    if (tools.length) {
      body.tools = [{ functionDeclarations: tools }];
    }

    const res = await fetch(`${API_BASE}/${encodeURIComponent(this.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Gemini error ${res.status}: ${detail.slice(0, 500)}`);
      if (res.status === 429) throw new Error('Kuota Gemini sedang habis. Coba lagi beberapa saat lagi.');
      if (/billing|free tier/i.test(detail)) {
        throw new Error(
          'Project Google untuk GEMINI_API_KEY ini tidak mendapat kuota gratis. Buat API key di project baru lewat aistudio.google.com/apikey, atau aktifkan billing.'
        );
      }
      if (/API_KEY_INVALID|API key not valid/i.test(detail)) throw new Error('GEMINI_API_KEY tidak valid. Periksa kembali key-nya.');
      if (res.status === 400 || res.status === 403) throw new Error('GEMINI_API_KEY tidak punya akses ke Gemini API.');
      if (res.status === 404) throw new Error(`Model Gemini "${this.model}" tidak ditemukan. Atur GEMINI_MODEL.`);
      throw new Error('Layanan Gemini sedang bermasalah. Coba lagi nanti.');
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content as GeminiContent | undefined;
    if (!content?.parts?.length) {
      const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason;
      return { role: 'model', parts: [{ text: reason ? `Maaf, jawaban tidak dapat dibuat (${reason}).` : '' }] };
    }
    return { role: 'model', parts: content.parts };
  }
}
