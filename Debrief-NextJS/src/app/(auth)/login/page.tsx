"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, getIdToken } from "@/lib/firebase-auth";

function sendTokenToExtension(token: string, refreshToken: string): void {
  try {
    localStorage.setItem("debrief_ext_token", token);
    localStorage.setItem("debrief_ext_refresh_token", refreshToken);
    window.postMessage({ type: "DEBRIEF_AUTH_TOKEN", token, refreshToken }, window.location.origin);
  } catch {
    // Silently ignore if storage is unavailable
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromExtension = searchParams.get("ext") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await signIn(email, password);
      const token = await getIdToken();
      if (token) sendTokenToExtension(token, user.refreshToken);
      router.replace(fromExtension ? "/ext-auth-success" : "/home");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
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
        Welcome back
      </h2>
      <p className="text-[13.5px] text-[#6E6E73] mb-6 leading-relaxed">
        Sign in to your Debrief account.
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

        {error && (
          <p className="text-[13px] text-[#FF3B30] bg-[#FF3B30]/[0.07] rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 mt-1 bg-[#1D1D1F] text-white text-[14px] font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,0,0,0.14)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <p className="text-[13px] text-center text-[#6E6E73] mt-1">
          No account?{" "}
          <Link href="/signup" className="text-[#007AFF] font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
