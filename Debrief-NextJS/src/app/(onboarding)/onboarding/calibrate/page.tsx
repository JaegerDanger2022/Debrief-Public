"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CalibrationPrompt from "@/components/onboarding/CalibrationPrompt";
import CalibrationRecorder from "@/components/onboarding/CalibrationRecorder";
import { usersApi } from "@/lib/api/users";

export default function CalibratePage() {
  const router = useRouter();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!blob) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "baseline.webm");
      await usersApi.uploadBaseline(form);
      router.replace("/home");
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="text-3xl font-black uppercase mb-4">Set Your Baseline</h2>
      <p className="mb-2">
        Read the sentence below aloud at your natural pace. Takes about 10 seconds.
        This calibrates your baseline pitch and speaking rate so Debrief knows what's normal for you.
      </p>
      <p className="mb-6 text-sm font-mono text-brand-accent">
        Find somewhere quiet — background noise affects pitch accuracy.
      </p>
      <CalibrationPrompt />
      <div className="mt-6 flex flex-col gap-4">
        <CalibrationRecorder onComplete={setBlob} />
        {blob && (
          <>
            <audio controls src={URL.createObjectURL(blob)} className="w-full" />
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-brand-black text-brand-white px-8 py-4 font-bold uppercase shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full"
            >
              {submitting ? "Saving..." : "Save Baseline & Continue →"}
            </button>
          </>
        )}
        {error && <p className="text-brand-accent text-sm font-mono">{error}</p>}
      </div>
    </div>
  );
}
