import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";

export function Settings({ topK, setTopK, theme, setTheme }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (
        e.key === "Escape" ||
        (e.type === "pointerdown" && !ref.current.contains(e.target))
      )
        ref.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details className="settings" ref={ref}>
      <summary className="icon-button" aria-label="Cài đặt" title="Cài đặt">
        <SlidersHorizontal size={19} />
      </summary>
      <div className="settings-popover">
        <h3>Cài đặt</h3>
        <label htmlFor="theme">Giao diện</label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="system">Theo hệ thống</option>
          <option value="light">Sáng</option>
          <option value="dark">Tối</option>
        </select>
        <label className="range-label" htmlFor="top-k">
          <span>Số nguồn tìm kiếm (Top K)</span>
          <strong>{topK}</strong>
        </label>
        <input
          id="top-k"
          type="range"
          min="1"
          max="20"
          value={topK}
          onChange={(e) => setTopK(Number(e.target.value))}
        />
        <p>Tăng số nguồn để tìm thêm thông tin liên quan.</p>
      </div>
    </details>
  );
}
