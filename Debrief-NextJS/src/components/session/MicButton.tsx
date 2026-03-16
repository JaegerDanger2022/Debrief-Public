"use client";
interface MicButtonProps {
  isRecording: boolean;
  onToggle: () => void;
}

export default function MicButton({ isRecording, onToggle }: MicButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`w-48 h-48 rounded-none font-black text-xl uppercase transition-all ${
        isRecording
          ? "bg-brand-accent text-white animate-pulse"
          : "bg-brand-white text-brand-black border-4 border-brand-white shadow-brutal-lg"
      }`}
    >
      {isRecording ? "Stop" : "Start\nProcessing"}
    </button>
  );
}
