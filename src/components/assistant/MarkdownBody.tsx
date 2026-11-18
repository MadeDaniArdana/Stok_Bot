"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Konstanta di luar komponen agar referensinya stabil antar-render.
const REMARK_PLUGINS = [remarkGfm];
function isProofPhoto(src: unknown) {
  if (typeof src !== "string") return false;
  try {
    const url = new URL(src, window.location.origin);
    return (
      url.origin === window.location.origin &&
      /^\/api\/(tasks|distributions)\/[\w-]+\/photo$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

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
  // Hanya foto bukti milik sendiri yang ditampilkan; gambar eksternal tidak dimuat.
  img: ({ alt, src }) =>
    isProofPhoto(src) ? (
      <a href={src} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || "Foto bukti"}
          loading="lazy"
          className="my-3 max-h-80 rounded-xl border border-neutral-200 object-contain"
        />
      </a>
    ) : (
      <span className="text-neutral-500" title={typeof src === "string" ? src : undefined}>
        {alt || "Image"}
      </span>
    ),
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
