"use client";

import { useRef, useState } from "react";
import { History, Search } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Conversation } from "./chat-history";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(...inputs));

export function AssistantHistory({
  conversations,
  activeId,
  onSelect,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const filtered = conversations.filter((item) =>
    item.title.toLocaleLowerCase("id").includes(search.toLocaleLowerCase("id")),
  );

  return (
    <details ref={detailsRef} className="relative">
      <summary
        aria-label="Riwayat percakapan"
        className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-xs text-neutral-500 hover:bg-neutral-100 [&::-webkit-details-marker]:hidden"
      >
        <History className="size-[18px]" strokeWidth={1.6} />
        <span className="hidden sm:inline">Riwayat</span>
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-[min(300px,calc(100vw-100px))] rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg">
        <p className="px-3 py-2 text-xs font-semibold text-neutral-700">
          Percakapan Anda
        </p>
        <label className="mx-1 mb-2 flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5">
          <Search className="size-3.5 shrink-0 text-neutral-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Cari percakapan"
            placeholder="Cari percakapan"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-xs outline-none"
          />
        </label>
        <nav
          aria-label="Daftar percakapan"
          className="max-h-60 space-y-1 overflow-y-auto"
        >
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item.id}
                aria-current={item.id === activeId ? "page" : undefined}
                onClick={() => {
                  onSelect(item.id);
                  if (detailsRef.current) detailsRef.current.open = false;
                }}
                title={item.title}
                className={cn(
                  "block w-full truncate rounded-lg px-3 py-2.5 text-left text-xs text-neutral-600 hover:bg-neutral-100",
                  item.id === activeId && "bg-neutral-100 font-medium",
                )}
              >
                {item.title}
              </button>
            ))
          ) : (
            <p className="px-3 py-5 text-xs leading-relaxed text-neutral-400">
              {search
                ? "Tidak ada percakapan yang cocok."
                : "Percakapan baru akan muncul di sini."}
            </p>
          )}
        </nav>
        <p className="mt-2 border-t border-neutral-100 px-3 pb-1 pt-3 text-[10px] text-neutral-400">
          Riwayat disimpan di browser ini.
        </p>
      </div>
    </details>
  );
}
