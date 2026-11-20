import { NextRequest, NextResponse } from 'next/server';
import { AssistantService, MAX_HISTORY, MAX_MESSAGE_LENGTH } from '@/services/assistant.service';
import type { ChatTurn } from '@/lib/ai';
import { requireAdmin } from '@/lib/auth-server';
import { logError } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => null);
    const messages: unknown = body?.messages;

    if (!Array.isArray(messages) || !messages.length) {
      return NextResponse.json({ error: 'Pesan wajib diisi.' }, { status: 400 });
    }

    const history: ChatTurn[] = messages.slice(-MAX_HISTORY).map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: String(message?.content ?? '').slice(0, MAX_MESSAGE_LENGTH),
    }));
    if (history[history.length - 1].role !== 'user' || !history[history.length - 1].content.trim()) {
      return NextResponse.json({ error: 'Pesan terakhir harus berupa pertanyaan.' }, { status: 400 });
    }

    const reply = await AssistantService.ask(history);
    return NextResponse.json({ reply });
  } catch (error) {
    await logError({
      source: 'AI',
      error,
      location: `Asisten AI (${process.env.AI_PROVIDER || 'default'})`,
      context: { model: process.env.OPENAI_MODEL || process.env.GEMINI_MODEL || null },
    });
    return NextResponse.json(
      {
        error:
          'Asisten AI masih dalam pengembangan dan belum bisa menjawab saat ini. Detail kendala sudah tercatat di menu Log Error.',
      },
      { status: 503 }
    );
  }
}
