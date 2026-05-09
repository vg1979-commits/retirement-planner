/// <reference types="vite/client" />
import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import ReleaseNoteCard from "./ReleaseNoteCard";

interface GithubRelease {
  tag_name: string;
  published_at: string;
  body: string;
}

// Skeleton card shown during loading
function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
        <div className="h-5 w-12 bg-slate-100 rounded-full ml-auto" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
        <div className="h-3 bg-slate-100 rounded w-3/5" />
      </div>
    </div>
  );
}

export default function ReleaseNotesList() {
  const [releases, setReleases] = useState<GithubRelease[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owner = import.meta.env.VITE_GITHUB_OWNER as string | undefined;
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined;

  const repoUrl = owner && repo ? `https://github.com/${owner}/${repo}/releases` : null;

  useEffect(() => {
    if (!owner || !repo) {
      setError("GitHub repository not configured.");
      return;
    }

    fetch(`https://api.github.com/repos/${owner}/${repo}/releases`)
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        return res.json() as Promise<GithubRelease[]>;
      })
      .then(setReleases)
      .catch(() => setError("Couldn't load release notes."));
  }, [owner, repo]);

  if (error) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm">
        <p className="mb-2">{error} Check back later or view them on GitHub.</p>
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm"
          >
            View on GitHub <ExternalLink size={13} />
          </a>
        )}
      </div>
    );
  }

  if (releases === null) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (releases.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-12">No releases published yet.</p>;
  }

  return (
    <div className="space-y-4">
      {releases.map((r, i) => (
        <ReleaseNoteCard
          key={r.tag_name}
          tagName={r.tag_name}
          publishedAt={r.published_at}
          body={r.body}
          isLatest={i === 0}
        />
      ))}
    </div>
  );
}
