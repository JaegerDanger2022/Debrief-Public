export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.10),0_4px_12px_rgba(0,0,0,0.06)] p-8">
        {/* Brand mark */}
        <div className="mb-8 flex justify-center">
          <img src="/logo.svg" alt="Debrief" width={48} height={48} />
        </div>
        {children}
      </div>
    </div>
  );
}
