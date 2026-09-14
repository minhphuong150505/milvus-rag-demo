import {
  ArrowUpRight,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  Globe2,
  Sparkles,
} from "lucide-react";

const suggestions = [
  {
    icon: Building2,
    label: "Về FPT",
    question: "FPT hoạt động trong những lĩnh vực nào?",
  },
  {
    icon: ChartNoAxesCombined,
    label: "Kết quả kinh doanh",
    question: "Doanh thu của FPT năm 2024 là bao nhiêu?",
  },
  {
    icon: Sparkles,
    label: "Công nghệ & đổi mới",
    question: "Chiến lược AI của FPT là gì?",
  },
  {
    icon: Globe2,
    label: "Dấu ấn toàn cầu",
    question: "FPT hiện diện tại bao nhiêu quốc gia?",
  },
];
export function Welcome({ onSend, loading }) {
  return (
    <div className="welcome">
      <span className="welcome-symbol">
        <BookOpen size={32} strokeWidth={1.5} />
      </span>
      <span className="eyebrow">TRI THỨC KẾT NỐI, CÂU TRẢ LỜI RÕ RÀNG</span>
      <h1>
        Bạn muốn hiểu gì
        <br />
        về <em>FPT</em> hôm nay?
      </h1>
      <p>
        Khám phá doanh nghiệp qua những cuộc trò chuyện.
        <br className="desktop-break" /> Mỗi câu trả lời đều bắt đầu từ tài
        liệu.
      </p>
      <div className="suggestion-grid">
        {suggestions.map(({ icon: Icon, label, question }) => (
          <button
            className="suggestion-card"
            disabled={loading}
            key={label}
            onClick={() => onSend(question)}
          >
            <span className="suggestion-heading">
              <Icon size={17} />
              <span>{label}</span>
              <ArrowUpRight size={15} />
            </span>
            <span>{question}</span>
          </button>
        ))}
      </div>
      <div className="welcome-footnote">
        <span />
        Sẵn sàng cùng bạn khám phá
      </div>
    </div>
  );
}
