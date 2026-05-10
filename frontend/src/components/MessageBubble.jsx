import ReactMarkdown from 'react-markdown';

export function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const className = isUser ? 'user-row' : 'assistant-row';
  const bubbleClass = isUser ? 'user-bubble' : 'assistant-bubble';

  return (
    <article className={className}>
      <div className={bubbleClass}>
        <ReactMarkdown>{message.content}</ReactMarkdown>
        {!isUser && message.latencyMs !== null && message.latencyMs !== undefined && (
          <div className="message-meta">
            <span>{message.grounded ? 'Grounded answer' : 'Fallback answer'}</span>
            <span>{message.latencyMs} ms</span>
          </div>
        )}
      </div>
    </article>
  );
}
