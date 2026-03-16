"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/firebase-auth";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password);
      router.replace("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2
        className="text-[20px] font-semibold text-[#1D1D1F] mb-1"
        style={{ letterSpacing: "-0.02em" }}
      >
        Create account
      </h2>
      <p className="text-[13.5px] text-[#6E6E73] mb-6 leading-relaxed">
        Start capturing voice intents and browser context.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 text-[14px] bg-[#F5F5F7] rounded-xl border border-black/[0.08] outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] transition-all placeholder:text-[#6E6E73]"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 text-[14px] bg-[#F5F5F7] rounded-xl border border-black/[0.08] outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] transition-all placeholder:text-[#6E6E73]"
        />

        <label className="flex items-start gap-3 text-[13px] text-[#6E6E73] leading-relaxed cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-[#007AFF]"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <span>I consent to prosody (voice tone) analysis for personalized insights.</span>
        </label>

        {error && (
          <p className="text-[13px] text-[#FF3B30] bg-[#FF3B30]/[0.07] rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !consent}
          className="w-full py-3 mt-1 bg-[#1D1D1F] text-white text-[14px] font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>

        <p className="text-[13px] text-center text-[#6E6E73] mt-1">
          Already have an account?{" "}
          <Link href="/login" className="text-[#007AFF] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
