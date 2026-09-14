import { ArrowUpRight, BookOpen, MessageSquare, Plus } from "lucide-react";

export function Sidebar({ onNew, children }) {
  return (
    <div className="sidebar-content">
      <a
        className="brand-row"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onNew();
        }}
        aria-label="FPT Tri thức — hội thoại mới"
      >
        <span className="brand-mark">
          <BookOpen size={23} />
        </span>
        <span>
          <strong>
            FPT <span className="brand-light">Tri thức</span>
          </strong>
          <small>TRỢ LÝ DOANH NGHIỆP</small>
        </span>
      </a>
      <button
        className="new-chat"
        aria-label="Tạo hội thoại mới"
        onClick={onNew}
      >
        <Plus size={18} />
        Hội thoại mới<span className="shortcut">＋</span>
      </button>
      <div className="sidebar-label">HỘI THOẠI CỦA BẠN</div>
      <div className="conversation-list">
        {children || (
          <p className="sidebar-empty">
            <MessageSquare size={20} />
            Những cuộc trò chuyện của bạn sẽ xuất hiện ở đây.
          </p>
        )}
      </div>
      <div className="knowledge-card">
        <span className="eyebrow">KHÔNG GIAN TRI THỨC</span>
        <h3>Hiểu thêm về FPT</h3>
        <p>
          Từ chiến lược đến con người.
          <br />
          Khám phá qua từng câu hỏi.
        </p>
        <BookOpen className="knowledge-icon" size={48} strokeWidth={1} />
      </div>
      <a
        className="sidebar-footer"
        href="https://fpt.com"
        target="_blank"
        rel="noreferrer"
      >
        Khám phá FPT
        <ArrowUpRight size={16} />
      </a>
    </div>
  );
}
