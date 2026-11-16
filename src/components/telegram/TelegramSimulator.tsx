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
  telegramMessageId?: number;
  inlineKeyboard?: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
}

export function TelegramSimulator() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: '👋 Selamat datang di StockFlow Bot!\nPilih menu dengan menekan tombol di bawah.',
      time: '19:00',
      telegramMessageId: 1,
      inlineKeyboard: [
        [
          { text: '📦 Cek stok', callback_data: 'menu:stock' },
          { text: '🔎 Cari barang', callback_data: 'menu:search' },
        ],
        [{ text: '📜 Riwayat saya', callback_data: 'menu:history' }],
        [{ text: '❔ Bantuan', callback_data: 'menu:help' }],
      ],
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

  const handleSend = async (
    customText?: string,
    callbackData?: string,
    callbackMessageId?: number
  ) => {
    const textToSend = customText || inputText;
    if ((!textToSend.trim() && !callbackData) || isSending) return;

    const userObj = usersMap[selectedUser];
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (!callbackData) {
      setMessages((prev) => [...prev, {
        id: Math.random().toString(),
        sender: 'user',
        text: textToSend.trim(),
        time: nowTime,
      }]);
      if (!customText) setInputText('');
    }
    setIsSending(true);

    try {
      const res = await fetch('/api/telegram/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: callbackData ? undefined : textToSend.trim(),
          callbackData,
          messageId: callbackMessageId,
          telegramUserId: userObj.id,
          username: userObj.username,
        }),
      });

      const data = await res.json();
      const currentBotMessage = messages.find((message) => message.telegramMessageId === callbackMessageId);
      const botMsg: ChatMessage = {
        id: callbackData && currentBotMessage ? currentBotMessage.id : Math.random().toString(),
        sender: 'bot',
        text: data.result?.replyText || 'Tidak ada balasan dari bot.',
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        actionTaken: data.result?.actionTaken,
        telegramMessageId: callbackData && currentBotMessage
          ? currentBotMessage.telegramMessageId
          : Math.floor(Math.random() * 1000000000),
        inlineKeyboard: data.result?.replyMarkup?.inline_keyboard,
      };

      if (callbackData && currentBotMessage) {
        setMessages((prev) => prev.map((message) =>
          message.telegramMessageId === callbackMessageId ? botMsg : message
        ));
      } else {
        setMessages((prev) => [...prev, botMsg]);
      }

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
    { label: '📦 Cek stok', cmd: '/stok' },
    { label: '🔎 Cari barang', cmd: '🔎 Cari barang' },
    { label: '📜 Riwayat saya', cmd: '/riwayat' },
    { label: '❔ Bantuan', cmd: '/bantuan' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-soft flex flex-col h-[600px]">
      {/* Simulator Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-maroon-900 to-maroon-950 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20">
            <Bot className="w-5 h-5 text-maroon-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-white">StockFlow Bot Simulator</h4>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
            </div>
            <p className="text-[11px] text-maroon-200">Simulasi menu tombol dan alur Telegram</p>
          </div>
        </div>

        {/* User Persona Picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-maroon-200 hidden sm:inline">Simulasi Pengguna:</span>
          <select
            value={selectedUser}
            onChange={(e: any) => setSelectedUser(e.target.value)}
            className="text-xs bg-maroon-800 text-white border border-maroon-700 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-white"
          >
            <option value="siti">Siti Rahma (@sitirahma_ops)</option>
            <option value="ahmad">Ahmad Fauzi (@ahmadfauzi_dev)</option>
            <option value="unlinked">User Asing (Belum Terhubung)</option>
          </select>
        </div>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.sender === 'bot' && (
              <div className="w-7 h-7 rounded-full bg-maroon-800 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 text-xs shadow-sm ${
                m.sender === 'user'
                  ? 'bg-maroon-800 text-white rounded-tr-none'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed font-sans">{m.text}</div>
              {m.inlineKeyboard?.map((row, rowIndex) => (
                <div key={`${m.id}-row-${rowIndex}`} className="flex flex-wrap gap-1.5 mt-2">
                  {row.map((button, buttonIndex) => button.url ? (
                    <a
                      key={`${m.id}-button-${buttonIndex}`}
                      href={button.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-maroon-50 text-maroon-800 border border-maroon-200 font-semibold"
                    >
                      {button.text}
                    </a>
                  ) : (
                    <button
                      key={`${m.id}-button-${buttonIndex}`}
                      onClick={() => handleSend(button.text, button.callback_data, m.telegramMessageId)}
                      disabled={isSending}
                      className="px-2.5 py-1.5 rounded-lg bg-maroon-50 text-maroon-800 border border-maroon-200 font-semibold disabled:opacity-50"
                    >
                      {button.text}
                    </button>
                  ))}
                </div>
              ))}
              <div
                className={`text-[9px] mt-1 text-right ${
                  m.sender === 'user' ? 'text-maroon-200' : 'text-slate-400'
                }`}
              >
                {m.time}
              </div>
            </div>

            {m.sender === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-maroon-700" />
            StockFlow Bot sedang memproses transaksi...
          </div>
        )}
      </div>

      {/* Quick Pills */}
      <div className="px-4 py-2 border-t border-slate-100 bg-white flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">Menu cepat:</span>
        {quickPills.map((pill, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(pill.cmd)}
            disabled={isSending}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-maroon-50 hover:text-maroon-800 border border-slate-200 whitespace-nowrap transition-colors"
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
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
      >
        <textarea
          rows={2}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ketik nama pemasang, lokasi, atau catatan..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="h-10 px-4 rounded-xl bg-maroon-800 hover:bg-maroon-900 active:bg-maroon-950 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Kirim</span>
        </button>
      </form>
    </div>
  );
}
