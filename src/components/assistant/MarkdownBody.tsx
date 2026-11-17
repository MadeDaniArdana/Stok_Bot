"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Konstanta di luar komponen agar referensinya stabil antar-render.
const REMARK_PLUGINS = [remarkGfm];
const MARKDOWN_COMPONENTS: Components = {
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-700"
    >
      {children}
    </a>
  ),
  img: ({ alt }) => <span className="text-neutral-500">{alt || "Image"}</span>,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full border-collapse text-left text-sm tabular-nums">
        {children}
      </table>
    </div>
  ),
};

/**
 * Parsing Markdown cukup mahal. Di-memo per isi pesan supaya mengetik di kolom chat
 * tidak mem-parse ulang seluruh riwayat jawaban di setiap ketukan tombol.
 * File ini dimuat terpisah (lazy) dari AssistantMessage agar halaman asisten awal tetap ringan.
 */
export const MarkdownBody = memo(function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="assistant-markdown">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
