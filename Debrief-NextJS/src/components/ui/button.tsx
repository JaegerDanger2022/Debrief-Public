import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 font-bold uppercase transition-all",
        variant === "default" && "bg-brand-black text-brand-white shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none",
        variant === "outline" && "border-2 border-brand-black hover:bg-brand-black hover:text-brand-white",
        variant === "destructive" && "bg-brand-accent text-white shadow-brutal",
        className
      )}
      {...props}
    />
  );
}
