import ReleaseNotesList from "../components/release-notes/ReleaseNotesList";

export default function ReleaseNotesView() {
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Release Notes</h1>
      <p className="text-sm text-slate-500 mb-6">What's changed in each version of the app.</p>
      <ReleaseNotesList />
    </div>
  );
}
