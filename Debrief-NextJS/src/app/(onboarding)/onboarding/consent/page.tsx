"use client";
import { useRouter } from "next/navigation";
export default function ConsentPage() {
  const router = useRouter();
  return (
    <div>
      <h2 className="text-3xl font-black uppercase mb-4">Your Data, Your Control</h2>
      <p className="text-sm mb-6">We process your voice for acoustic metrics (pitch, pace). Raw audio is never stored. Only text summaries and abstracted metrics are saved. You can delete everything at any time.</p>
      <button onClick={() => router.push("/onboarding/calibrate")} className="bg-brand-accent text-white px-8 py-4 font-bold uppercase shadow-brutal w-full">
        I Understand & Consent
      </button>
    </div>
  );
}
