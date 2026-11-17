export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "error" | "notice";
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
}

export function readConversations(value: string | null): Conversation[] {
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is Conversation => {
      return (
        item &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.updatedAt === "number" &&
        Number.isFinite(item.updatedAt) &&
        Array.isArray(item.messages) &&
        item.messages.every((message: Message) => {
          return (
            message &&
            typeof message.id === "string" &&
            ["user", "assistant"].includes(message.role) &&
            typeof message.content === "string" &&
            (!message.status || ["error", "notice"].includes(message.status))
          );
        })
      );
    })
    .slice(0, 30)
    .map((item) => ({ ...item, messages: item.messages.slice(-80) }));
}
