import { Database, RotateCcw } from 'lucide-react';
import { ChatBox } from './components/ChatBox.jsx';
import { SourceList } from './components/SourceList.jsx';
import { useChat } from './hooks/useChat.js';

const EXAMPLE_QUESTIONS = [
  'Công ty cung cấp sản phẩm hoặc dịch vụ gì?',
  'Chính sách đổi trả hoặc hoàn tiền như thế nào?',
  'Thời gian giao hàng dự kiến là bao lâu?',
  'Tôi liên hệ bộ phận hỗ trợ bằng cách nào?',
  'Thời tiết hôm nay thế nào?',
];

export default function App() {
  const {
    messages,
    sources,
    topK,
    loading,
    error,
    setTopK,
    sendMessage,
    resetChat,
  } = useChat();

  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Thiết lập hội thoại">
        <div className="brand-row">
          <span className="brand-mark">
            <Database size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h1>RAG Chatbot</h1>
            <p>Milvus + Spring Boot</p>
          </div>
        </div>

        <section className="control-group" aria-labelledby="examples-title">
          <h2 id="examples-title">Câu hỏi mẫu</h2>
          <div className="example-list">
            {EXAMPLE_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                className="example-button"
                onClick={() => sendMessage(question)}
                disabled={loading}
              >
                {question}
              </button>
            ))}
          </div>
        </section>

        <section className="control-group" aria-labelledby="retrieval-title">
          <h2 id="retrieval-title">Retrieval</h2>
          <label className="range-label" htmlFor="top-k">
            <span>Top K</span>
            <strong>{topK}</strong>
          </label>
          <input
            id="top-k"
            type="range"
            min="1"
            max="10"
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value))}
          />
        </section>

        <button
          type="button"
          className="icon-text-button"
          onClick={resetChat}
          title="Xóa hội thoại"
        >
          <RotateCcw size={16} />
          <span>Xóa hội thoại</span>
        </button>
      </aside>

      <ChatBox
        messages={messages}
        loading={loading}
        error={error}
        onSend={sendMessage}
      />

      <SourceList sources={sources} />
    </main>
  );
}
