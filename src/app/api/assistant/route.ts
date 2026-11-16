import { NextRequest, NextResponse } from 'next/server';
import { AssistantService, MAX_HISTORY, MAX_MESSAGE_LENGTH } from '@/services/assistant.service';
import type { ChatTurn } from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Dilindungi middleware: hanya admin yang sudah login.
export async function POST(req: NextRequest) {
  try {
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
    console.error('Assistant failed:', error);
    const message = error instanceof Error ? error.message : 'Asisten sedang tidak dapat menjawab.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
