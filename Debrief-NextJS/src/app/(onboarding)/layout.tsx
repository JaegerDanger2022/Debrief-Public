import AuthGuard from "@/components/layout/AuthGuard";
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-white p-8">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </div>
    </AuthGuard>
  );
}
