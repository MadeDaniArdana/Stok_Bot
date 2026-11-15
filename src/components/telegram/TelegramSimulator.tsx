'use client';

import React, { useState } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  actionTaken?: string;
}

export function TelegramSimulator() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: '👋 *Selamat datang di StockFlow Bot!*\n\nKetik `/bantuan` untuk melihat format pengambilan barang, atau gunakan tombol cepat di bawah.',
      time: '19:00',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedUser, setSelectedUser] = useState<'siti' | 'ahmad' | 'unlinked'>('siti');

  const usersMap = {
    siti: { id: '78291044', username: 'sitirahma_ops', name: 'Siti Rahma (Staff Terdaftar)' },
    ahmad: { id: '91823746', username: 'ahmadfauzi_dev', name: 'Ahmad Fauzi (Staff Terdaftar)' },
    unlinked: { id: '99999999', username: 'orang_asing', name: 'User Belum Terhubung (Testing Error)' },
  };

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || isSending) return;

    const userObj = usersMap[selectedUser];
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Append user message
    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: textToSend.trim(),
      time: nowTime,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputText('');
    setIsSending(true);

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend.trim(),
          telegramUserId: userObj.id,
          username: userObj.username,
        }),
      });

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'bot',
        text: data.result?.replyText || 'Tidak ada balasan dari bot.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        actionTaken: data.result?.actionTaken,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (data.result?.actionTaken === 'STOCK_OUT_SUCCESS') {
        showToast('Stok Berhasil Terpotong!', 'Transaksi pengambilan via Telegram telah dicatat di database.');
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: `❌ Terjadi kesalahan jaringan: ${e.message}`,
          time: nowTime,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const quickPills = [
    { label: '📦 Cek Stok (/stok)', cmd: '/stok' },
    { label: '🔍 Cari Kertas (/cari Kertas)', cmd: '/cari Kertas' },
    { label: '📜 Riwayat Saya (/riwayat)', cmd: '/riwayat' },
    {
      label: '📝 Ambil 5 Kertas A4',
      cmd: `PAKAI\nBarang: PAP-A4-01\nJumlah: 5\nKeperluan: Cetak berkas operasional mingguan`,
    },
    {
      label: '⚠️ Coba Ambil Melebihi Stok (Toner)',
      cmd: `PAKAI\nBarang: TNR-HP-85A\nJumlah: 10\nKeperluan: Kebutuhan printer divisi`,
    },
  ];

  return (
    <div className="glass-panel rounded-3xl border-2 border-white/80 shadow-[0_20px_50px_rgba(128,0,32,0.12)] ring-1 ring-black/5 overflow-hidden flex flex-col h-[640px] relative">
      {/* Simulator Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-maroon-900 via-maroon-800 to-maroon-950 text-white flex items-center justify-between border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-md">
            <Bot className="w-5 h-5 text-rose-200 drop-shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm text-white tracking-tight">StockFlow 3D Telegram Bot</h4>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-sm animate-pulse"></span>
            </div>
            <p className="text-[11px] text-rose-200/90 font-medium">Uji webhook & parser perintah real-time</p>
          </div>
        </div>

        {/* User Persona Picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-rose-200 hidden sm:inline font-medium">Persona:</span>
          <select
            value={selectedUser}
            onChange={(e: any) => setSelectedUser(e.target.value)}
            className="text-xs bg-maroon-950/80 backdrop-blur-md text-white border border-white/20 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400 font-medium"
          >
            <option value="siti">Siti Rahma (@sitirahma_ops)</option>
            <option value="ahmad">Ahmad Fauzi (@ahmadfauzi_dev)</option>
            <option value="unlinked">User Asing (Belum Terhubung)</option>
          </select>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-5 overflow-y-auto bg-slate-50/50 backdrop-blur-sm space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bot' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-maroon-800 to-maroon-950 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-maroon shadow-sm ring-1 ring-white/50">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs transition-all ${
                m.sender === 'user'
                  ? 'bg-gradient-to-br from-maroon-800 via-maroon-900 to-maroon-950 text-white rounded-tr-xs shadow-[0_6px_18px_rgba(128,0,32,0.25)] border border-maroon-700/60'
                  : 'glass-card text-slate-800 rounded-tl-xs shadow-soft'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed font-sans">{m.text}</div>
              <div
                className={`text-[9px] mt-1.5 text-right font-semibold ${
                  m.sender === 'user' ? 'text-rose-200' : 'text-slate-400'
                }`}
              >
                {m.time}
              </div>
            </div>

            {m.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm ring-1 ring-white/50">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-maroon-800 font-semibold italic bg-white/70 backdrop-blur-md px-3 py-2 rounded-xl border border-white/80 w-fit">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-maroon-700" />
            StockFlow Bot sedang memproses mutasi transaksi...
          </div>
        )}
      </div>

      {/* Quick Pills */}
      <div className="px-4 py-2.5 border-t border-white/80 bg-white/60 backdrop-blur-md flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Template:</span>
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(pill.cmd)}
            disabled={isSending}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/80 text-slate-700 hover:bg-white hover:text-maroon-900 border border-white/90 whitespace-nowrap transition-all shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0 badge-3d"
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3.5 border-t border-white/80 bg-white/80 backdrop-blur-md flex items-center gap-2.5"
      >
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ketik perintah atau format PAKAI (Enter untuk kirim)..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 text-xs bg-white/90 border border-slate-200/80 rounded-2xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-maroon-500/30 focus:border-maroon-700 font-medium shadow-inner"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="btn-3d h-12 px-5 rounded-2xl bg-maroon-800 hover:bg-maroon-700 text-white text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Send className="w-4 h-4" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
}
