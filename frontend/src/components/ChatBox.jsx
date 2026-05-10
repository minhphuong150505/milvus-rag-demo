import { SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { LoadingDots } from './LoadingDots.jsx';
import { MessageBubble } from './MessageBubble.jsx';

export function ChatBox({ messages, loading, error, onSend }) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading]);

  function submit(event) {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;
    onSend(value);
    setDraft('');
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(event);
    }
  }

  return (
    <section className="chat-panel" aria-label="Hội thoại">
      <div className="chat-header">
        <div>
          <h2>Hội thoại</h2>
          <p>Hỏi đáp có truy xuất nguồn từ Milvus</p>
        </div>
        <span className={loading ? 'status-pill active' : 'status-pill'}>
          {loading ? 'Retrieving' : 'Ready'}
        </span>
      </div>

      <div className="message-list" ref={scrollRef}>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {loading && (
          <div className="assistant-row">
            <div className="assistant-bubble compact">
              <LoadingDots />
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-strip">{error}</div>}

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Nhập câu hỏi"
          aria-label="Nhập câu hỏi"
        />
        <button type="submit" className="send-button" disabled={loading || !draft.trim()} title="Gửi">
          <SendHorizontal size={18} />
        </button>
      </form>
    </section>
  );
}
