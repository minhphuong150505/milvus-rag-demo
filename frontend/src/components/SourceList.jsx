import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe2,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef } from "react";

function publicUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
export function SourceList({ sources, highlighted, selectedId }) {
  const listRef = useRef(null);
  useEffect(() => {
    if (highlighted)
      listRef.current
        ?.querySelector(`[data-source="${highlighted}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [highlighted, selectedId]);
  return (
    <aside className="sources-panel" aria-label="Nguồn trích dẫn">
      <div className="sources-header">
        <div>
          <h2>Nguồn trích dẫn</h2>
          <p>Cơ sở cho câu trả lời của bạn</p>
        </div>
        <span>{sources.length.toString().padStart(2, "0")}</span>
      </div>
      <div className="source-list" ref={listRef}>
        {sources.length === 0 ? (
          <div className="sources-empty">
            <span className="source-empty-icon">
              <Layers size={28} strokeWidth={1.2} />
            </span>
            <h3>Thông tin có nguồn gốc</h3>
            <p>Khi bạn đặt câu hỏi, tài liệu liên quan sẽ xuất hiện tại đây.</p>
            <div className="source-placeholder">
              <div />
              <div />
              <div />
            </div>
            <div className="source-placeholder second">
              <div />
              <div />
            </div>
            <span className="source-empty-note">
              <ShieldCheck size={14} />
              Minh bạch trong từng câu trả lời
            </span>
          </div>
        ) : (
          <>
            <p className="source-intro">
              {sources.length} đoạn trích cho câu trả lời đang chọn. Bấm “Nguồn”
              ở câu trả lời khác để xem lại.
            </p>
            {sources.map((source, index) => {
              const url = publicUrl(source.sourceUrl);
              const type =
                source.sourceType?.toLowerCase() || (url ? "web" : "text");
              const Icon = type === "web" ? Globe2 : FileText;
              const score =
                typeof source.score === "number" &&
                Number.isFinite(source.score)
                  ? Math.min(100, Math.max(0, source.score * 100))
                  : null;
              return (
                <article
                  key={`${selectedId}-${index}`}
                  data-source={index + 1}
                  className={`source-item ${highlighted === index + 1 ? "highlighted" : ""}`}
                  tabIndex={0}
                  aria-label={`Nguồn ${index + 1}: ${source.docTitle || "Tài liệu doanh nghiệp"}`}
                >
                  <div className="source-kind">
                    <span>
                      <Icon size={13} />
                      {type === "web"
                        ? "TRANG WEB"
                        : type === "pdf"
                          ? "PDF"
                          : "VĂN BẢN"}
                    </span>
                    <span className="source-number">{index + 1}</span>
                  </div>
                  <div className="source-title-row">
                    <h3>{source.docTitle || "Tài liệu doanh nghiệp"}</h3>
                  </div>
                  <div className="source-meta">
                    {source.page > 0 && <span>Trang {source.page}</span>}
                    <span>
                      {score === null
                        ? "Chưa có điểm tương đồng"
                        : `Tương đồng ${score.toFixed(1)}%`}
                    </span>
                  </div>
                  {score !== null && (
                    <meter
                      className="similarity"
                      min="0"
                      max="100"
                      value={score}
                      aria-label="Điểm tương đồng"
                    >
                      {score}%
                    </meter>
                  )}
                  <details className="source-excerpt">
                    <summary>Xem đoạn trích</summary>
                    <p>
                      {source.chunkText ||
                        source.snippet ||
                        "Chưa có đoạn trích."}
                    </p>
                  </details>
                  {url ? (
                    <a
                      className="source-link"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở tài liệu gốc
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="local-source">
                      <BookOpen size={12} />
                      Tài liệu nội bộ
                    </span>
                  )}
                </article>
              );
            })}
          </>
        )}
      </div>
      <div className="sources-footnote">
        <ShieldCheck size={15} />
        <p>
          Câu trả lời dựa trên tài liệu đã cung cấp. Điểm tương đồng thể hiện
          mức độ gần nhau về nội dung.
        </p>
      </div>
    </aside>
  );
}
