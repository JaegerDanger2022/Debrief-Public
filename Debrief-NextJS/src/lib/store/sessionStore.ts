import { create } from "zustand";
import type { SessionTag } from "@/types/session";

interface SessionStore {
  status: "idle" | "recording" | "processing" | "complete";
  tag: SessionTag | null;
  transcriptChunks: string[];
  bargeInMessage: string | null;
  setStatus: (s: SessionStore["status"]) => void;
  setTag: (t: SessionTag | null) => void;
  addTranscriptChunk: (chunk: string) => void;
  setBargeInMessage: (msg: string | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  status: "idle",
  tag: null,
  transcriptChunks: [],
  bargeInMessage: null,
  setStatus: (status) => set({ status }),
  setTag: (tag) => set({ tag }),
  addTranscriptChunk: (chunk) => set((s) => ({ transcriptChunks: [...s.transcriptChunks, chunk] })),
  setBargeInMessage: (bargeInMessage) => set({ bargeInMessage }),
  reset: () => set({ status: "idle", tag: null, transcriptChunks: [], bargeInMessage: null }),
}));
