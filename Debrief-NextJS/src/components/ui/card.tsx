import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("border-brutal border-brand-black shadow-brutal p-6 bg-white", className)}>
      {children}
    </div>
  );
}
