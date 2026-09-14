import { Check, MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onRename,
  onDelete,
}) {
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState(null);
  return conversations.map((c) => (
    <div
      className={`conversation-item ${c.id === activeId ? "active" : ""}`}
      key={c.id}
    >
      {editing === c.id ? (
        <form
          className="rename-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) {
              onRename(c.id, title);
              setEditing(null);
            }
          }}
        >
          <input
            autoFocus
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Tên hội thoại"
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(null);
            }}
          />
          <button
            className="icon-button"
            aria-label="Lưu tên"
            disabled={!title.trim()}
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Hủy đổi tên"
            onClick={() => setEditing(null)}
          >
            <X size={15} />
          </button>
        </form>
      ) : (
        <>
          <button
            className="conversation-title"
            onClick={() => onSelect(c.id)}
            aria-current={c.id === activeId ? "page" : undefined}
          >
            <MessageSquare size={15} />
            <span>{c.title}</span>
          </button>
          <div className="conversation-actions">
            <button
              className="icon-button"
              aria-label={`Đổi tên ${c.title}`}
              onClick={() => {
                setTitle(c.title);
                setEditing(c.id);
              }}
            >
              <Pencil size={13} />
            </button>
            <button
              className="icon-button"
              aria-label={`Xóa ${c.title}`}
              onClick={() => setDeleting(c.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </>
      )}
      {deleting === c.id && (
        <div className="delete-confirm">
          <span>Xóa hội thoại này?</span>
          <button
            onClick={() => {
              onDelete(c.id);
              setDeleting(null);
            }}
          >
            Xóa
          </button>
          <button onClick={() => setDeleting(null)}>Hủy</button>
        </div>
      )}
    </div>
  ));
}
