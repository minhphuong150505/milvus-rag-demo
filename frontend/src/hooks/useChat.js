import { useEffect, useRef, useState } from "react";
import {
  loadConversations,
  newConversation,
  saveConversations,
} from "../lib/conversations.js";
import { askChat } from "../api/chatApi.js";

export function useChat() {
  const [state, setState] = useState(() => {
    const saved = loadConversations();
    if (saved) return saved;
    const conversation = newConversation();
    return { conversations: [conversation], activeId: conversation.id };
  });
  const [storageError, setStorageError] = useState("");
  const conversation =
    state.conversations.find((c) => c.id === state.activeId) ||
    state.conversations[0];
  const messages = conversation.messages;
  const setMessages = (update, targetId = conversation.id) =>
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((c) => {
        if (c.id !== targetId) return c;
        const next = update(c.messages);
        return {
          ...c,
          messages: next,
          updatedAt: new Date().toISOString(),
          title:
            c.messages.length === 0 && next.length
              ? next[0].content.slice(0, 55)
              : c.title,
        };
      }),
    }));
  useEffect(() => {
    // Debounce writes during streaming; persist on page exit as well.
    const save = () => {
      try {
        saveConversations(state);
        setStorageError("");
      } catch {
        setStorageError(
          "Không thể lưu trên trình duyệt. Hội thoại vẫn còn trong phiên này.",
        );
      }
    };
    const timer = setTimeout(save, 400);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [state]);
  const [selectedId, setSelectedId] = useState(null);
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const active = useRef(null);
  useEffect(() => () => active.current?.abort(), []);

  async function sendMessage(question, retryId) {
    const trimmed = question.trim();
    if (!trimmed || active.current) return false;
    const index = retryId
      ? messages.findIndex((m) => m.id === retryId)
      : messages.length;
    const context = messages.slice(0, index);
    if (retryId && context.at(-1)?.role === "user") context.pop();
    const history = context
      .filter((m) => !m.error && !m.pending && !m.stopped && m.content)
      .slice(-12)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    const id = retryId || crypto.randomUUID();
    const controller = new AbortController();
    active.current = controller;
    const createdAt = new Date().toISOString();
    const answer = {
      id,
      role: "assistant",
      content: "",
      createdAt,
      sources: [],
      pending: true,
      question: trimmed,
    };
    setMessages((current) =>
      retryId
        ? current.map((m) => (m.id === retryId ? answer : m))
        : [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "user",
              content: trimmed,
              createdAt,
            },
            answer,
          ],
    );
    setSelectedId(id);
    setLoading(true);
    const patch = (change) =>
      setMessages((current) =>
        current.map((m) => (m.id === id ? { ...m, ...change } : m)),
      );
    let content = "";
    try {
      const response = await askChat(
        { question: trimmed, topK, sessionId: conversation.id, history },
        {
          signal: controller.signal,
          onEvent: (event, data) => {
            if (event === "sources")
              patch({ sources: data.sources || [], phase: "composing" });
            if (event === "token") {
              content += data.token;
              patch({ content, phase: "composing" });
            }
            if (event === "reset") {
              content = "";
              patch({ content: "", sources: [], phase: "searching" });
            }
          },
        },
      );
      patch({
        ...response,
        content: response.answer ?? content,
        pending: false,
      });
    } catch (error) {
      patch(
        controller.signal.aborted
          ? { pending: false, stopped: true }
          : {
              pending: false,
              error:
                error.name === "TimeoutError"
                  ? "Phản hồi quá lâu. Vui lòng thử lại."
                  : "Không nhận được phản hồi. Kiểm tra kết nối và thử lại.",
            },
      );
    } finally {
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
    return true;
  }

  function stop() {
    active.current?.abort();
  }
  function selectConversation(id) {
    stop();
    setState((current) => ({ ...current, activeId: id }));
    setSelectedId(null);
  }
  function resetChat() {
    stop();
    if (state.conversations.length >= 50) {
      setStorageError("Đã có 50 hội thoại. Xóa một hội thoại cũ để tạo thêm.");
      return;
    }
    const next = newConversation();
    setState((current) => ({
      conversations: [next, ...current.conversations],
      activeId: next.id,
    }));
    setSelectedId(null);
  }
  function renameConversation(id, title) {
    if (title.trim())
      setState((current) => ({
        ...current,
        conversations: current.conversations.map((c) =>
          c.id === id ? { ...c, title: title.trim().slice(0, 80) } : c,
        ),
      }));
  }
  function deleteConversation(id) {
    if (id === conversation.id) stop();
    setState((current) => {
      let remaining = current.conversations.filter((c) => c.id !== id);
      if (!remaining.length) remaining = [newConversation()];
      return {
        conversations: remaining,
        activeId: current.activeId === id ? remaining[0].id : current.activeId,
      };
    });
    setSelectedId(null);
  }
  function setDraft(draft) {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((c) =>
        c.id === conversation.id ? { ...c, draft } : c,
      ),
    }));
  }
  const activeAnswerId =
    selectedId || messages.findLast((m) => m.role === "assistant")?.id;
  return {
    conversations: state.conversations,
    conversationId: conversation.id,
    draft: conversation.draft,
    setDraft,
    storageError,
    selectConversation,
    renameConversation,
    deleteConversation,
    messages,
    sources: messages.find((m) => m.id === activeAnswerId)?.sources || [],
    selectedId: activeAnswerId,
    setSelectedId,
    topK,
    setTopK,
    loading,
    sendMessage,
    stop,
    resetChat,
    regenerate: (message) => sendMessage(message.question, message.id),
  };
}
