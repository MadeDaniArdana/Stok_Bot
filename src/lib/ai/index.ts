import { GeminiProvider } from './gemini';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { AIProvider } from './types';

export type { AIProvider, AITool, ChatTurn, ToolCall } from './types';
export { ToolsNotSupportedError } from './types';

/**
 * Memilih penyedia AI dari AI_PROVIDER:
 * - "openai": API berformat OpenAI, misalnya server Qwen lokal (OPENAI_BASE_URL, OPENAI_API_KEY, OPENAI_MODEL)
 * - "gemini": Google Gemini (GEMINI_API_KEY, GEMINI_MODEL)
 * Default: "openai" jika OPENAI_BASE_URL terisi, selain itu "gemini".
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || (process.env.OPENAI_BASE_URL ? 'openai' : 'gemini')).toLowerCase();

  switch (provider) {
    case 'openai':
    case 'local':
    case 'qwen': {
      const baseUrl = process.env.OPENAI_BASE_URL;
      const model = process.env.OPENAI_MODEL;
      if (!baseUrl || !model) throw new Error('OPENAI_BASE_URL dan OPENAI_MODEL wajib diisi untuk AI_PROVIDER=openai.');
      return new OpenAICompatibleProvider(baseUrl, process.env.OPENAI_API_KEY || '', model);
    }
    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY belum diisi. Tambahkan di .env / Environment Variables Vercel.');
      return new GeminiProvider(apiKey, process.env.GEMINI_MODEL || undefined);
    }
    default:
      throw new Error(`AI_PROVIDER "${provider}" belum didukung.`);
  }
}
