import { Database, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ChatBox } from './components/ChatBox.jsx';
import { SourceList } from './components/SourceList.jsx';
import { useChat } from './hooks/useChat.js';

const EXAMPLE_QUESTIONS = [
  'FPT hoạt động tại bao nhiêu quốc gia và có bao nhiêu nhân viên?',
  'Doanh thu của FPT năm 2024 là bao nhiêu?',
  'Tầm nhìn chiến lược của FPT đến năm 2030 là gì?',
  'FPT Software cung cấp những dịch vụ gì cho khách hàng quốc tế?',
  'Chính sách ESG và phát triển bền vững của FPT như thế nào?',
  'FPT Telecom cung cấp những dịch vụ viễn thông nào?',
  'FPT phục vụ những ngành công nghiệp nào?',
  'Chiến lược AI của FPT là gì?',
  'Thời tiết Hà Nội hôm nay thế nào?',
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
            <p>Milvus retrieval console</p>
          </div>
        </div>

        <div className="rail-summary" aria-label="Thông tin hệ thống">
          <span>company_kb</span>
          <span>Ollama</span>
          <span>Spring Boot</span>
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
          <div className="section-title-row">
            <h2 id="retrieval-title">Retrieval</h2>
            <SlidersHorizontal size={15} />
          </div>
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
