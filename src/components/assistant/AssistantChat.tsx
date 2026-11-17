"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  ClipboardList,
  PackageSearch,
  ShieldCheck,
  Square,
  SquarePen,
  TrendingUp,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/components/layout/AuthContext";
import { AssistantHistory } from "./AssistantHistory";
import { AssistantMessage } from "./AssistantMessage";
import {
  readConversations,
  type Conversation,
  type Message,
} from "./chat-history";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));
const MAX_INPUT = 1000;
const suggestions = [
  {
    label: "Cek stok menipis",
    question: "Barang apa saja yang stoknya menipis dan perlu diisi kembali?",
    icon: PackageSearch,
    color: "text-amber-600",
  },
  {
    label: "Pantau pemasangan",
    question: "Apa saja yang sudah dipasang minggu ini?",
    icon: ClipboardList,
    color: "text-sky-600",
  },
  {
    label: "Lihat tugas tertunda",
    question: "Tugas pemasangan mana yang belum mengirim foto bukti?",
    icon: ShieldCheck,
    color: "text-emerald-600",
  },
  {
    label: "Ringkas barang keluar",
    question: "Tolong ringkas barang yang keluar bulan ini.",
    icon: TrendingUp,
    color: "text-maroon-700",
  },
];

export function AssistantChat() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<{
    controller: AbortController;
    conversationId: string;
  } | null>(null);
  const stickToBottom = useRef(true);
  const storageKey = currentUser?.id
    ? `stockflow:assistant:v1:${currentUser.id}`
    : null;
  const ready = storageKey !== null && loadedKey === storageKey;
  const active = ready
    ? conversations.find((item) => item.id === activeId)
    : undefined;
  const messages = active?.messages || [];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!storageKey) return;
    try {
      setConversations(readConversations(localStorage.getItem(storageKey)));
      setStorageError(false);
    } catch {
      setConversations([]);
      setStorageError(true);
    }
    setActiveId(null);
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!ready || !storageKey) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          conversations.slice(0, 30).map((item) => ({
            ...item,
            messages: item.messages.slice(-80),
          })),
        ),
      );
    } catch {
      setStorageError(true);
    }
  }, [conversations, ready, storageKey]);

  useEffect(() => {
    if (stickToBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending, activeId]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 192) + "px";
    };
    resize();
    let width = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.clientWidth !== width) {
        width = textarea.clientWidth;
        resize();
      }
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [input, hasMessages]);

  useEffect(() => () => requestRef.current?.controller.abort(), []);

  const stop = () => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setSending(false);
  };

  const newChat = () => {
    stop();
    setActiveId(null);
    setInput("");
    setAwayFromBottom(false);
    stickToBottom.current = true;
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const selectChat = (id: string) => {
    stop();
    setActiveId(id);
    setInput("");
    setAwayFromBottom(false);
    stickToBottom.current = true;
  };

  const send = async (text: string, retry = false) => {
    const question = text.trim();
    if (!question || requestRef.current || !ready) return;
    const conversationId = activeId || crypto.randomUUID();
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === "user",
    );
    const previous =
      retry && lastUserIndex >= 0 ? messages.slice(0, lastUserIndex) : messages;
    const next: Message[] = [
      ...previous,
      { id: crypto.randomUUID(), role: "user", content: question },
    ];
    const controller = new AbortController();
    requestRef.current = { controller, conversationId };
    setSending(true);
    setActiveId(conversationId);
    setInput("");
    stickToBottom.current = true;
    setAwayFromBottom(false);
    setConversations((items) => {
      const existing = items.find((item) => item.id === conversationId);
      const conversation: Conversation = {
        id: conversationId,
        title: existing?.title || question.replace(/\s+/g, " ").slice(0, 80),
        updatedAt: Date.now(),
        messages: next,
      };
      return [
        conversation,
        ...items.filter((item) => item.id !== conversationId),
      ].slice(0, 30);
    });
    requestAnimationFrame(() => inputRef.current?.focus());

    const append = (message: Omit<Message, "id">) => {
      setConversations((items) =>
        items.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                updatedAt: Date.now(),
                messages: [
                  ...item.messages,
                  { ...message, id: crypto.randomUUID() },
                ],
              }
            : item,
        ),
      );
    };

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: next
            .filter((message) => !message.status)
            .slice(-20)
            .map(({ role, content }) => ({ role, content })),
        }),
      });
      if (response.status === 401)
        throw new Error(
          "Sesi Anda sudah berakhir. Silakan masuk kembali untuk melanjutkan.",
        );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.error || "Asisten belum dapat menjawab. Silakan coba lagi.",
        );
      if (typeof data.reply !== "string" || !data.reply.trim())
        throw new Error("Jawaban belum diterima. Silakan coba lagi.");
      append({ role: "assistant", content: data.reply });
    } catch (error) {
      if (controller.signal.aborted) {
        append({
          role: "assistant",
          content: "Respons dihentikan.",
          status: "notice",
        });
      } else {
        append({
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan. Silakan coba lagi.",
          status: "error",
        });
      }
    } finally {
      if (requestRef.current?.controller === controller) {
        requestRef.current = null;
        setSending(false);
      }
    }
  };

  const composer = (
    <div className="mx-auto w-full max-w-[800px] px-4 sm:px-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="rounded-[28px] border border-[#e5e5e5] bg-[#f4f4f4] p-3 shadow-sm focus-within:border-neutral-300"
      >
        <textarea
          ref={inputRef}
          aria-label="Pertanyaan untuk asisten"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={MAX_INPUT}
          placeholder="Tanyakan apa saja tentang gudang Anda"
          className="block max-h-48 min-h-12 w-full resize-none border-0 bg-transparent px-2 py-3 text-base leading-7 text-neutral-800 outline-none placeholder:text-neutral-500"
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 px-2.5 py-1.5 text-[11px] text-neutral-500">
            <Boxes className="size-3.5" strokeWidth={1.5} />
            Data StockFlow
          </span>
          <div className="flex items-center gap-3">
            {input.length > 800 && (
              <span className="text-[10px] tabular-nums text-neutral-400">
                {input.length}/{MAX_INPUT}
              </span>
            )}
            {sending ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Hentikan respons"
                title="Hentikan respons"
                className="flex size-9 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-600"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !ready}
                aria-label="Kirim pertanyaan"
                title="Kirim pertanyaan"
                className="flex size-9 items-center justify-center rounded-full bg-neutral-800 text-white hover:bg-neutral-600 disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                <ArrowUp className="size-5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </form>
      {storageError && (
        <p role="status" className="mt-2 px-2 text-xs text-amber-700">
          Riwayat belum bisa disimpan di browser ini. Percakapan tetap dapat
          dilanjutkan.
        </p>
      )}
    </div>
  );

  return (
    <div className="assistant-app flex h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-neutral-800">
      <a
        href="#assistant-input"
        onClick={() => inputRef.current?.focus()}
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Langsung ke kolom pertanyaan
      </a>
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-lg font-semibold text-neutral-600">
              StockFlow <span className="font-normal text-neutral-400">AI</span>
            </span>
            <span className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[9px] font-medium text-neutral-400">
              BETA
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AssistantHistory
              conversations={ready ? conversations : []}
              activeId={activeId}
              onSelect={selectChat}
            />
            <button
              onClick={newChat}
              aria-label="Mulai percakapan baru"
              title="Chat baru"
              className="action-button action-icon action-info"
            >
              <SquarePen className="size-[19px]" strokeWidth={1.6} />
            </button>
          </div>
        </header>

        {hasMessages ? (
          <>
            <div
              ref={scrollRef}
              onScroll={() => {
                const node = scrollRef.current;
                if (!node) return;
                const away =
                  node.scrollHeight - node.scrollTop - node.clientHeight > 100;
                stickToBottom.current = !away;
                setAwayFromBottom(away);
              }}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              <div
                role="log"
                aria-label="Percakapan dengan asisten"
                aria-live="polite"
                aria-relevant="additions"
                className="mx-auto w-full max-w-[800px] px-5 pb-12 pt-4 sm:px-8"
              >
                {messages.map((message, index) => (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    onRetry={
                      message.status &&
                      index === messages.length - 1 &&
                      !sending
                        ? () => {
                            const last = [...messages]
                              .reverse()
                              .find((item) => item.role === "user");
                            if (last) send(last.content, true);
                          }
                        : undefined
                    }
                  />
                ))}
                {sending && (
                  <div
                    role="status"
                    className="flex items-center gap-3 py-6 text-sm text-neutral-500"
                  >
                    <span className="size-2.5 rounded-full bg-neutral-700" />
                    Mencari data gudang...
                  </div>
                )}
              </div>
            </div>
            <div className="relative shrink-0 bg-white pt-2">
              {awayFromBottom && (
                <button
                  onClick={() => {
                    if (scrollRef.current)
                      scrollRef.current.scrollTop =
                        scrollRef.current.scrollHeight;
                    stickToBottom.current = true;
                    setAwayFromBottom(false);
                  }}
                  aria-label="Ke pesan terbaru"
                  className="absolute -top-12 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm"
                >
                  <ArrowDown className="size-4" />
                </button>
              )}
              <div id="assistant-input">{composer}</div>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-h-full flex-col justify-center pb-16 pt-10 sm:pb-24">
              <div className="mx-auto mb-8 w-full max-w-[800px] px-6 text-center">
                <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl border border-neutral-100 bg-[#fafafa] text-maroon-800">
                  <Boxes className="size-6" strokeWidth={1.5} />
                </div>
                <p className="mb-3 text-sm text-neutral-400">
                  Asisten gudang pribadi Anda
                </p>
                <h1 className="text-balance text-[28px] font-medium leading-tight text-neutral-800 sm:text-[34px]">
                  Apa yang ingin Anda ketahui?
                </h1>
              </div>
              <div id="assistant-input">{composer}</div>
              <div className="mx-auto mt-6 flex w-full max-w-[800px] flex-wrap justify-center gap-2 px-5 sm:px-6">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    disabled={!ready}
                    onClick={() => send(suggestion.question)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    <suggestion.icon
                      className={cn("size-4 shrink-0", suggestion.color)}
                      strokeWidth={1.6}
                    />
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <footer className="shrink-0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 text-center text-[10px] leading-5 text-neutral-400 sm:text-[11px]">
          StockFlow AI masih dalam pengembangan. Periksa kembali informasi
          penting.
        </footer>
      </div>
    </div>
  );
}
