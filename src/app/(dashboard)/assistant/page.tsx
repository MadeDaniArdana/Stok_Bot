import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const metadata: Metadata = {
  title: "Asisten AI — StockFlow",
  description:
    "Tanyakan stok, pemasangan, dan riwayat gudang melalui percakapan dengan asisten StockFlow.",
};

export default function AssistantPage() {
  return <AssistantChat />;
}
