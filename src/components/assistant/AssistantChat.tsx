'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, X, LoaderCircle, RotateCcw } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

const SUGGESTIONS = [
  'Barang apa saja yang stoknya menipis?',
  'Apa saja yang dipasang minggu ini?',
  'Tugas mana yang belum kirim foto?',
  'Berapa lampu yang keluar bulan ini?',
];

const GREETING: Message = {
  role: 'assistant',
  content:
    'Halo! Saya asisten StockFlow (versi uji coba, masih dalam pengembangan). Tanyakan soal stok, tugas pemasangan, atau riwayat barang masuk dan keluar. Jawaban bisa saja belum akurat.',
};

export function AssistantFab() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;

    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Kirim percakapan tanpa sapaan awal dan pesan error.
          messages: next.filter((m) => m !== GREETING && !m.isError).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Asisten sedang tidak dapat menjawab.');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: error instanceof Error ? error.message : 'Terjadi kesalahan.', isError: true },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Asisten StockFlow"
          className="fixed z-50 bottom-20 right-4 left-4 sm:left-auto sm:w-[380px] h-[min(560px,calc(100vh-7rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-maroon-800 to-maroon-950 text-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight flex items-center gap-1.5">
                  Asisten StockFlow
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded">
                    Beta
                  </span>
                </p>
                <p className="text-[10px] text-white/70">Masih dalam pengembangan</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([GREETING])}
                className="p-1.5 rounded-lg hover:bg-white/15"
                aria-label="Mulai percakapan baru"
                title="Percakapan baru"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Tutup asisten">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pesan */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                    message.role === 'user'
                      ? 'bg-maroon-800 text-white rounded-br-sm'
                      : message.isError
                        ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> Mencari data...
                </div>
              </div>
            )}

            {messages.length === 1 && !sending && (
              <div className="pt-1 space-y-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-maroon-200 bg-white text-maroon-900 hover:bg-maroon-50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t border-slate-200 bg-white flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={1000}
              placeholder="Tulis pertanyaan..."
              aria-label="Pertanyaan untuk asisten"
              className="flex-1 resize-none max-h-24 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="p-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Kirim pertanyaan"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Tombol melayang */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed z-50 bottom-4 right-4 w-14 h-14 rounded-full bg-gradient-to-br from-maroon-700 to-maroon-950 text-white shadow-lg shadow-maroon-900/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        aria-label={open ? 'Tutup asisten' : 'Buka asisten AI'}
        title="Asisten AI"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </>
  );
}
