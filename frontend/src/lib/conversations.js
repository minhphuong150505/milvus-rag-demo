export const STORAGE_KEY = "fpt-conversations-v1";
export const newConversation = () => ({
  id: crypto.randomUUID(),
  title: "Hội thoại mới",
  messages: [],
  draft: "",
  updatedAt: new Date().toISOString(),
});
export function loadConversations() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data?.version !== 1 || !Array.isArray(data.conversations)) return null;
    const conversations = data.conversations
      .filter(
        (c) =>
          typeof c.id === "string" &&
          typeof c.title === "string" &&
          Array.isArray(c.messages),
      )
      .slice(0, 50)
      .map((c) => ({
        ...c,
        draft: typeof c.draft === "string" ? c.draft.slice(0, 2000) : "",
        messages: c.messages
          .filter(
            (m) =>
              typeof m.id === "string" &&
              ["user", "assistant"].includes(m.role) &&
              typeof m.content === "string",
          )
          .map((m) => ({
            ...m,
            sources: Array.isArray(m.sources) ? m.sources : [],
            ...(m.pending ? { pending: false, stopped: true } : {}),
          })),
      }));
    if (!conversations.length) return null;
    return {
      conversations,
      activeId: conversations.some((c) => c.id === data.activeId)
        ? data.activeId
        : conversations[0].id,
    };
  } catch {
    return null;
  }
}
export function saveConversations(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...state }));
}
