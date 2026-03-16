"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { onAuthStateChanged } from "@/lib/firebase-auth";

const CORE_VALUES = [
  "Stop using tabs as a to-do list.",
  "Capture intent the moment it appears.",
  "Keep flow state instead of switching apps.",
  "Turn scattered web findings into organized action.",
  "Convert reflection into trackable insight.",
];

const PRODUCT_SURFACES = [
  {
    title: "Web App",
    body: "Dashboard views, history, insights, and settings for reviewing what happened and deciding what happens next.",
  },
  {
    title: "Chrome Extension",
    body: "Fast capture, voice-triggered workflows, and side-panel operations that keep the browser usable while work keeps moving.",
  },
  {
    title: "Persistent Ledger",
    body: "A staged operational queue for the things you want to keep, enrich, route, and resolve later.",
  },
  {
    title: "AI Orchestration Layer",
    body: "Background enrichment, memory, and routing logic that turns raw captures into usable context.",
  },
];

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged((user) => setAuthed(!!user));
    return unsub;
  }, []);

  return (
    <main className="min-h-screen text-[#1D1D1F]">
      <section className="relative overflow-hidden px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex items-center justify-between rounded-full border border-white/45 bg-white/45 px-4 py-3 backdrop-blur-xl shadow-[0_12px_30px_rgba(135,148,170,0.10)]">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Debrief" width={28} height={28} />
              <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">Debrief</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {authed ? (
                <Link href="/home" className="text-[#3A3A3C] transition-colors hover:text-[#1D1D1F]" aria-label="Account">
                  <UserCircle size={22} strokeWidth={1.6} />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-[#3A3A3C] transition-colors hover:text-[#1D1D1F]">
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-full bg-[#1D1D1F] px-4 py-2 font-semibold text-white shadow-[0_10px_24px_rgba(29,29,31,0.18)] transition-transform hover:-translate-y-0.5"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center rounded-full border border-white/45 bg-white/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5B6573] backdrop-blur-xl">
                Voice, AI, and an operational ledger
              </div>
              <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.95] tracking-[-0.06em] sm:text-6xl lg:text-8xl">
                Capture intent. Enrich context. Resolve browser chaos.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4C5664] sm:text-xl">
                Debrief helps people capture intent, enrich context, and resolve browser chaos through voice, AI, and a persistent operational ledger.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-[#1D1D1F] px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-[0_12px_28px_rgba(29,29,31,0.18)] transition-transform hover:-translate-y-0.5"
                >
                  Start With Debrief
                </Link>
                <Link
                  href={authed ? "/home" : "/login"}
                  className="rounded-full border border-[#1D1D1F]/10 bg-white/55 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#1D1D1F] backdrop-blur-xl transition-colors hover:bg-white/75"
                >
                  Open App
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/50 bg-[linear-gradient(160deg,rgba(255,255,255,0.64),rgba(255,255,255,0.28))] p-6 backdrop-blur-2xl shadow-[0_20px_44px_rgba(123,137,160,0.14)]">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#738092]">
                    Why It Matters
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-[-0.03em]">
                    More than a chatbot. More than a clipper.
                  </div>
                </div>
                <div className="rounded-full bg-[#1D1D1F] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                  Built for flow
                </div>
              </div>
              <p className="text-[15px] leading-7 text-[#4C5664]">
                Debrief is not just another chatbot and not just another web clipper. It combines voice interaction,
                structured capture, agentic research, persistent staging in a ledger, and downstream routing into real workflows.
              </p>
              <p className="mt-4 text-[15px] leading-7 text-[#4C5664]">
                This makes it useful both as a personal clarity tool and as an execution layer for knowledge work.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-8 sm:px-10 lg:px-14">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-[30px] border border-white/45 bg-white/42 p-7 backdrop-blur-2xl shadow-[0_18px_38px_rgba(123,137,160,0.10)]">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#738092]">Core User Value</div>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">What the user gets back.</h2>
            <p className="mt-3 text-[15px] leading-7 text-[#4C5664]">
              Debrief is designed to reduce context switching and turn momentary intent into an organized, usable system.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {CORE_VALUES.map((item, index) => (
              <div
                key={item}
                className="rounded-[26px] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.28))] p-5 backdrop-blur-xl shadow-[0_12px_28px_rgba(123,137,160,0.08)]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8794A7]">
                  0{index + 1}
                </div>
                <p className="mt-4 text-[15px] font-medium leading-7 text-[#1D1D1F]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-8 sm:px-10 lg:px-14">
        <div className="mx-auto max-w-7xl rounded-[34px] border border-white/45 bg-white/38 p-7 backdrop-blur-2xl shadow-[0_18px_44px_rgba(123,137,160,0.12)] sm:p-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#738092]">Product Surface</div>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
              One system, multiple working surfaces.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#4C5664]">
              Debrief includes a web app for dashboard views, history, insights, and settings; a Chrome extension for capture and side-panel workflows; a persistent ledger for staged items; and an AI orchestration layer for enrichment and memory.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {PRODUCT_SURFACES.map((surface) => (
              <div
                key={surface.title}
                className="rounded-[24px] border border-white/50 bg-[linear-gradient(160deg,rgba(255,255,255,0.66),rgba(245,248,252,0.32))] p-6 shadow-[0_10px_24px_rgba(123,137,160,0.08)]"
              >
                <h3 className="text-xl font-semibold tracking-[-0.03em]">{surface.title}</h3>
                <p className="mt-3 text-[15px] leading-7 text-[#4C5664]">{surface.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <div className="mx-auto max-w-7xl rounded-[36px] border border-[#1D1D1F]/8 bg-[linear-gradient(135deg,rgba(30,33,38,0.96),rgba(51,56,64,0.88))] p-8 text-white shadow-[0_24px_48px_rgba(41,47,57,0.24)] sm:p-10">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">One-Line Positioning</div>
            <h2 className="mt-4 text-3xl font-black uppercase tracking-[-0.05em] sm:text-5xl">
              Debrief helps people capture intent, enrich context, and resolve browser chaos.
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/72">
              Through voice, AI, and a persistent operational ledger, Debrief turns scattered findings and unfinished tabs into a clear capture-to-resolution workflow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-[#1D1D1F] transition-transform hover:-translate-y-0.5"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/18 bg-white/6 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-xl transition-colors hover:bg-white/12"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
