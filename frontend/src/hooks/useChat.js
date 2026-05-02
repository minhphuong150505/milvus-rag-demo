import { useMemo, useState } from 'react';
import { askChat } from '../api/chatApi.js';

const initialMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Tôi sẵn sàng trả lời dựa trên tài liệu đã ingest vào Milvus.',
  grounded: true,
  latencyMs: null,
  sources: [],
};

export function useChat() {
  const [messages, setMessages] = useState([initialMessage]);
  const [sources, setSources] = useState([]);
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sessionId = useMemo(() => crypto.randomUUID(), []);

  async function sendMessage(question) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setError('');
    setLoading(true);

    try {
      const response = await askChat({ question: trimmed, sessionId, topK });
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        grounded: response.grounded,
        latencyMs: response.latencyMs,
        sources: response.sources || [],
      };
      setMessages((current) => [...current, assistantMessage]);
      setSources(response.sources || []);
    } catch (exception) {
      const message =
        exception?.response?.data?.error ||
        exception?.message ||
        'Không thể gửi câu hỏi.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function resetChat() {
    setMessages([initialMessage]);
    setSources([]);
    setError('');
  }

  return {
    messages,
    sources,
    topK,
    loading,
    error,
    setTopK,
    sendMessage,
    resetChat,
  };
}
