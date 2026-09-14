import { BookOpen, Menu, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { ChatBox } from "./components/ChatBox.jsx";
import { SourceList } from "./components/SourceList.jsx";
import { ConversationList } from "./components/ConversationList.jsx";
import { Sidebar } from "./components/Sidebar.jsx";
import { Drawer } from "./components/Drawer.jsx";
import { Settings } from "./components/Settings.jsx";
import { useChat } from "./hooks/useChat.js";
import { useTheme } from "./hooks/useTheme.js";
import { useHealth } from "./hooks/useHealth.js";

export default function App() {
  const chat = useChat();
  const [theme, setTheme] = useTheme();
  const health = useHealth();
  const [highlighted, setHighlighted] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const sidebar = (
    <Sidebar
      onNew={() => {
        chat.resetChat();
        setDrawer(null);
      }}
    >
      <ConversationList
        conversations={chat.conversations}
        activeId={chat.conversationId}
        onSelect={(id) => {
          chat.selectConversation(id);
          setDrawer(null);
        }}
        onRename={chat.renameConversation}
        onDelete={chat.deleteConversation}
      />
    </Sidebar>
  );
  const sources = (
    <SourceList
      sources={chat.sources}
      highlighted={highlighted}
      selectedId={chat.selectedId}
    />
  );
  return (
    <main className="app-shell">
      <aside className="rail" aria-label="Lịch sử hội thoại">
        {sidebar}
      </aside>
      <section className="workspace" aria-label="Trợ lý FPT">
        <header className="workspace-header">
          <button
            className="icon-button menu-toggle"
            aria-label="Mở lịch sử hội thoại"
            onClick={() => setDrawer("sidebar")}
          >
            <Menu size={20} />
          </button>
          <div className="workspace-title">
            <strong>Trợ lý FPT</strong>
            <span>Hỏi đáp từ tài liệu doanh nghiệp</span>
          </div>
          <div className="header-actions">
            <span className={`health ${health}`} role="status">
              <i />
              {health === "online"
                ? "Đã kết nối"
                : health === "offline"
                  ? "Mất kết nối"
                  : "Đang kết nối"}
            </span>
            <button
              className="icon-button"
              aria-label="Chuyển sáng / tối"
              title="Chuyển sáng / tối"
              onClick={() =>
                setTheme(
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
                )
              }
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <Settings
              topK={chat.topK}
              setTopK={chat.setTopK}
              theme={theme}
              setTheme={setTheme}
            />
            <button
              className="icon-button sources-toggle"
              aria-label="Mở nguồn trích dẫn"
              onClick={() => setDrawer("sources")}
            >
              <BookOpen size={20} />
            </button>
          </div>
        </header>
        {chat.storageError && (
          <p className="storage-warning" role="status">
            {chat.storageError}
          </p>
        )}
        <ChatBox
          conversationId={chat.conversationId}
          draft={chat.draft}
          onDraft={chat.setDraft}
          messages={chat.messages}
          loading={chat.loading}
          onSend={chat.sendMessage}
          onStop={chat.stop}
          onRegenerate={chat.regenerate}
          selectedId={chat.selectedId}
          onSelect={(id) => {
            chat.setSelectedId(id);
            setHighlighted(null);
          }}
          onCitation={(id, source) => {
            chat.setSelectedId(id);
            setHighlighted(source);
            if (innerWidth < 1200) setDrawer("sources");
          }}
        />
      </section>
      <div className="desktop-sources">{sources}</div>
      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer === "sidebar" ? "Hội thoại" : "Nguồn trích dẫn"}
      >
        {drawer === "sidebar" ? sidebar : sources}
      </Drawer>
    </main>
  );
}
