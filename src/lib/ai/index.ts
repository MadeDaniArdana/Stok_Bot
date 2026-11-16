import { GeminiProvider } from './gemini';
import type { AIProvider } from './types';

export type { AIProvider, AITool, ChatTurn, ToolCall } from './types';

/**
 * Memilih penyedia AI dari AI_PROVIDER (default: gemini).
 * Untuk AI lokal nanti: tambahkan case baru, misalnya 'local' yang memanggil server Ollama.
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  switch (provider) {
    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY belum diisi. Tambahkan di .env / Environment Variables Vercel.');
      return new GeminiProvider(apiKey, process.env.GEMINI_MODEL || undefined);
    }
    default:
      throw new Error(`AI_PROVIDER "${provider}" belum didukung.`);
  }
}
