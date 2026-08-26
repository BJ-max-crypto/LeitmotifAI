export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function toApiConversation(messages: AiChatMessage[]) {
  return messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-18)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}
