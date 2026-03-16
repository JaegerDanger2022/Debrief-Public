"use client";
export default function ExtAuthSuccessPage() {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-black uppercase mb-4">
        You&apos;re connected.
      </h2>
      <p className="font-mono text-sm opacity-60 mb-6">
        The Debrief extension is now logged in.
        <br />
        You can close this tab and start capturing.
      </p>
      <p className="font-mono text-xs opacity-40">
        Press Cmd+Shift+S on any page to begin.
      </p>
    </div>
  );
}
