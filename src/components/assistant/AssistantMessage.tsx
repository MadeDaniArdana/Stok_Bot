"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Copy, RotateCcw, TriangleAlert } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Message } from "./chat-history";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

// react-markdown + remark-gfm (~55 KB) baru dimuat saat ada jawaban yang perlu ditampilkan.
// Setelah dimuat sekali, file tersimpan di cache browser sehingga jawaban berikutnya langsung tampil.
const MarkdownBody = dynamic(() => import("./MarkdownBody").then((mod) => mod.MarkdownBody), {
  ssr: false,
  loading: () => <div className="assistant-markdown whitespace-pre-wrap" />,
});

export function AssistantMessage({
  message,
  onRetry,
}: {
  message: Message;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  if (message.role === "user") {
    return (
      <div className="flex justify-end pb-2 pt-6">
        <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-3xl bg-[#f4f4f4] px-5 py-3 text-base leading-7 text-[#292929] sm:max-w-[80%]">
          <span className="sr-only">Anda: </span>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <article aria-label="Jawaban StockFlow AI" className="py-6">
      <div
        className={cn(
          "min-w-0 text-base leading-7 text-[#292929]",
          message.status === "error" &&
            "rounded-2xl border border-red-100 bg-red-50/60 p-4 text-red-800",
        )}
      >
        {message.status ? (
          <div className="flex items-start gap-2.5">
            {message.status === "error" && (
              <TriangleAlert className="mt-1 size-4 shrink-0" />
            )}
            <p
              role={message.status === "error" ? "alert" : "status"}
              className="text-pretty text-sm"
            >
              {message.content}
            </p>
          </div>
        ) : (
          <MarkdownBody content={message.content} />
        )}
      </div>
      <div className="mt-3 flex items-center gap-1 text-neutral-400">
        {!message.status && (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Jawaban disalin" : "Salin jawaban"}
            title={copied ? "Disalin" : "Salin jawaban"}
            className="action-button action-icon action-neutral"
          >
            {copied ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Copy className="size-4" strokeWidth={1.6} />
            )}
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="action-button action-edit"
          >
            <RotateCcw className="size-3.5" />
            Coba lagi
          </button>
        )}
        <span role="status" className="text-[11px]">
          {copied
            ? "Disalin"
            : copyError
              ? "Tidak dapat menyalin. Pilih teks jawaban untuk menyalinnya."
              : ""}
        </span>
      </div>
    </article>
  );
}
