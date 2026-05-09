interface Props {
  tagName: string;
  publishedAt: string;
  body: string;
  isLatest: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Minimal markdown renderer: handles headers, bold, bullet lists, blank-line paragraphs
function renderMarkdown(md: string): React.ReactNode[] {
  const blocks = md.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split("\n");

    // Unordered list block
    if (lines.every((l) => /^[-*] /.test(l.trim()) || l.trim() === "")) {
      return (
        <ul key={bi} className="list-disc list-inside space-y-0.5 mb-3 text-slate-700">
          {lines.filter((l) => l.trim()).map((l, li) => (
            <li key={li}>{renderInline(l.replace(/^[-*] /, "").trim())}</li>
          ))}
        </ul>
      );
    }

    // Single-line heading
    if (lines.length === 1) {
      const h2 = lines[0].match(/^## (.+)/);
      if (h2) return <h2 key={bi} className="text-base font-semibold text-slate-800 mt-4 mb-1">{h2[1]}</h2>;
      const h3 = lines[0].match(/^### (.+)/);
      if (h3) return <h3 key={bi} className="text-sm font-semibold text-slate-700 mt-3 mb-1">{h3[1]}</h3>;
      const h1 = lines[0].match(/^# (.+)/);
      if (h1) return <h1 key={bi} className="text-lg font-bold text-slate-900 mt-4 mb-2">{h1[1]}</h1>;
    }

    // Paragraph
    return (
      <p key={bi} className="text-slate-700 mb-3 leading-relaxed">
        {lines.map((l, li) => (
          <span key={li}>{renderInline(l)}{li < lines.length - 1 && <br />}</span>
        ))}
      </p>
    );
  });
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) return <strong key={i}>{bold[1]}</strong>;
    return part;
  });
}

export default function ReleaseNoteCard({ tagName, publishedAt, body, isLatest }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono">
          {tagName}
        </span>
        {isLatest && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
            Latest
          </span>
        )}
        <span className="text-xs text-slate-400 ml-auto">{formatDate(publishedAt)}</span>
      </div>
      {body ? (
        <div className="text-sm">{renderMarkdown(body)}</div>
      ) : (
        <p className="text-sm text-slate-400 italic">No release notes provided.</p>
      )}
    </div>
  );
}
