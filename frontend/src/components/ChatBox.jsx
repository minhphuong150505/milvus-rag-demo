import { ArrowDown, ArrowUp, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageBubble } from "./MessageBubble.jsx";
import { Welcome } from "./Welcome.jsx";

export function ChatBox({
  messages,
  loading,
  onSend,
  onStop,
  onRegenerate,
  selectedId,
  onSelect,
  onCitation,
  conversationId = "default",
  draft,
  onDraft,
}) {
  const [localDraft, setLocalDraft] = useState("");
  const value = draft ?? localDraft;
  const setDraft = onDraft || setLocalDraft;
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const pinned = useRef(true);
  const [showBottom, setShowBottom] = useState(false);
  useLayoutEffect(() => {
    const el = inputRef.current;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  useLayoutEffect(() => {
    pinned.current = true;
    setShowBottom(false);
    const el = scrollRef.current;
    el.scrollTop = el.scrollHeight;
  }, [conversationId]);
  useEffect(() => {
    if (pinned.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);
  function toBottom() {
    pinned.current = true;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setShowBottom(false);
  }
  function submit(e) {
    e.preventDefault();
    if (!value.trim() || loading || value.length > 2000) return;
    onSend(value);
    setDraft("");
    toBottom();
    inputRef.current.focus();
  }
  return (
    <section className="chat-panel" aria-label="Hội thoại">
      <div
        className={`message-list ${messages.length ? "" : "is-empty"}`}
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          pinned.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          setShowBottom(!pinned.current);
        }}
      >
        {messages.length ? (
          <div className="messages-inner">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                loading={loading}
                selected={message.id === selectedId}
                onSelect={onSelect}
                onRegenerate={onRegenerate}
                onCitation={onCitation}
              />
            ))}
          </div>
        ) : (
          <Welcome loading={loading} onSend={onSend} />
        )}
      </div>
      {showBottom && (
        <button className="scroll-bottom" onClick={toBottom}>
          <ArrowDown size={16} />
          Cuộn xuống cuối
        </button>
      )}
      <div className="composer-area">
        <form className="composer" onSubmit={submit}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              )
                submit(e);
            }}
            rows={1}
            maxLength={2000}
            placeholder="Hỏi bất kỳ điều gì về FPT…"
            aria-label="Nhập câu hỏi"
            aria-describedby="composer-hint"
          />
          {loading ? (
            <button
              type="button"
              className="send-button stop-button"
              onClick={onStop}
              aria-label="Dừng trả lời"
              title="Dừng trả lời"
            >
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={!value.trim()}
              aria-label="Gửi câu hỏi"
              title="Gửi câu hỏi"
            >
              <ArrowUp size={20} />
            </button>
          )}
        </form>
        <div className="composer-hint" id="composer-hint">
          <span>AI có thể chưa chính xác. Hãy kiểm tra nguồn trích dẫn.</span>
          <span className="keyboard-hint">
            Enter gửi · Shift + Enter xuống dòng
          </span>
        </div>
      </div>
    </section>
  );
}
