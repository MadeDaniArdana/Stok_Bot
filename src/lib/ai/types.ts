/**
 * Antarmuka penyedia AI. Gemini dipakai sekarang; AI lokal (misalnya Ollama/LM Studio di server)
 * cukup membuat implementasi baru dari AIProvider lalu memilihnya lewat AI_PROVIDER di .env.
 */

/** Skema parameter alat (subset JSON Schema). */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, { type: 'string' | 'number'; description: string; enum?: string[] }>;
  required?: string[];
}

export interface AITool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  /**
   * Menjalankan percakapan dengan alat. `runTool` dipanggil setiap kali model meminta data;
   * hasilnya dikirim kembali ke model sampai model memberi jawaban teks.
   */
  chat(params: {
    system: string;
    history: ChatTurn[];
    tools: AITool[];
    runTool: (call: ToolCall) => Promise<unknown>;
    maxToolRounds?: number;
  }): Promise<string>;
}
