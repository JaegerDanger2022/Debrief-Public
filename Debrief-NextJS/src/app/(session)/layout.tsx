import AuthGuard from "@/components/layout/AuthGuard";
export default function SessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-brand-black text-brand-white flex flex-col items-center justify-center">
        {children}
      </div>
    </AuthGuard>
  );
}
