import {
  BookOpen,
  Check,
  CircleAlert,
  Copy,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LoadingDots } from "./LoadingDots.jsx";

// Transform only Markdown text nodes, leaving links and code intact.
function citationPlugin() {
  return (tree) => {
    const visit = (node) => {
      if (!node.children || ["link", "code", "inlineCode"].includes(node.type))
        return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== "text") {
          visit(child);
          return [child];
        }
        return child.value
          .split(/(\[\d+\])/g)
          .filter(Boolean)
          .map((value) =>
            /^\[\d+\]$/.test(value)
              ? {
                  type: "link",
                  url: `#source-${value.slice(1, -1)}`,
                  children: [{ type: "text", value }],
                }
              : { type: "text", value },
          );
      });
    };
    visit(tree);
  };
}

export function MessageBubble({
  message,
  loading,
  selected,
  onSelect,
  onRegenerate,
  onCitation,
}) {
  const [copied, setCopied] = useState("");
  const user = message.role === "user";
  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied("Đã sao chép");
    } catch {
      setCopied("Không thể sao chép");
    }
  }
  const time =
    message.createdAt &&
    new Date(message.createdAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (user)
    return (
      <article className="user-row">
        <div className="user-message">
          <div className="user-bubble">{message.content}</div>
          <time dateTime={message.createdAt}>{time}</time>
        </div>
      </article>
    );
  return (
    <article
      className={`assistant-row ${selected ? "selected" : ""}`}
      onClick={() => onSelect?.(message.id)}
    >
      <div className="answer-heading">
        <span className="answer-avatar">
          <BookOpen size={15} />
        </span>
        <strong>FPT Tri thức</strong>
        <time dateTime={message.createdAt}>{time}</time>
      </div>
      <div className="assistant-bubble">
        {message.content && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, citationPlugin]}
            components={{
              a: ({ href, children }) => {
                const match = /^#source-(\d+)$/.exec(href || "");
                if (match)
                  return Number(match[1]) <= (message.sources?.length || 0) ? (
                    <button
                      className="citation-chip"
                      aria-label={`Xem nguồn ${match[1]}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCitation?.(message.id, Number(match[1]));
                      }}
                    >
                      {children}
                    </button>
                  ) : (
                    <span>{children}</span>
                  );
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                );
              },
              table: ({ children }) => (
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Bảng dữ liệu"
                >
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.pending && (
          <div className="loading-status" role="status">
            <LoadingDots />
            {message.phase === "composing"
              ? "Đang soạn câu trả lời…"
              : "Đang tìm tài liệu…"}
          </div>
        )}
        {message.error && (
          <div className="error-strip" role="alert">
            <CircleAlert size={18} />
            <span>{message.error} Câu hỏi của bạn vẫn được giữ ở trên.</span>
            <button onClick={() => onRegenerate(message)} disabled={loading}>
              Thử lại
            </button>
          </div>
        )}
        {message.stopped && (
          <p className="stopped-note">
            Đã dừng trả lời. Bạn có thể hỏi lại khi sẵn sàng.
          </p>
        )}
      </div>
      {!message.pending && (
        <div className="answer-footer">
          {typeof message.grounded === "boolean" && (
            <span
              className={`grounded-badge ${message.grounded ? "" : "ungrounded"}`}
            >
              {message.grounded ? (
                <ShieldCheck size={13} />
              ) : (
                <CircleAlert size={13} />
              )}
              {message.grounded
                ? "Có căn cứ tài liệu"
                : "Không tìm thấy trong tài liệu"}
            </span>
          )}
          {message.latencyMs != null && (
            <span className="latency">
              {(message.latencyMs / 1000).toLocaleString("vi-VN", {
                maximumFractionDigits: 1,
              })}{" "}
              giây
            </span>
          )}
          <div className="answer-actions">
            {message.content && (
              <button
                className="icon-button"
                onClick={copy}
                title="Sao chép câu trả lời"
                aria-label="Sao chép câu trả lời"
              >
                {copied === "Đã sao chép" ? (
                  <Check size={15} />
                ) : (
                  <Copy size={15} />
                )}
              </button>
            )}
            <button
              className="icon-button"
              onClick={() => onRegenerate(message)}
              disabled={loading}
              title="Hỏi lại"
              aria-label="Hỏi lại"
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="source-select"
              onClick={() => onCitation?.(message.id, null)}
              aria-pressed={selected}
            >
              Nguồn ({message.sources?.length || 0})
            </button>
          </div>
          <span className="copy-feedback" role="status">
            {copied}
          </span>
        </div>
      )}
    </article>
  );
}
