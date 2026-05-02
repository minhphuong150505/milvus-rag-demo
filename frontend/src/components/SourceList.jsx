import { ExternalLink } from 'lucide-react';

export function SourceList({ sources }) {
  return (
    <aside className="sources-panel" aria-label="Nguồn">
      <div className="sources-header">
        <h2>Nguồn</h2>
        <span>{sources.length}</span>
      </div>

      <div className="source-list">
        {sources.length === 0 ? (
          <p className="empty-source">Chưa có nguồn phù hợp.</p>
        ) : (
          sources.map((source, index) => (
            <article className="source-item" key={`${source.sourceUrl}-${index}`}>
              <div className="source-title-row">
                <h3>{source.docTitle || 'Untitled'}</h3>
                {source.sourceUrl && (
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer" title="Mở nguồn">
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
              <div className="source-meta">
                <span>Score {formatScore(source.score)}</span>
                {source.page > 0 && <span>Trang {source.page}</span>}
              </div>
              <p>{source.snippet}</p>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function formatScore(score) {
  if (typeof score !== 'number') return '-';
  return score.toFixed(3);
}
