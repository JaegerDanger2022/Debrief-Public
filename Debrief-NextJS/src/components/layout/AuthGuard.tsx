"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUserStore } from "@/lib/store/userStore";
import { onAuthStateChanged } from "@/lib/firebase-auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, setUser, setLoading } = useUserStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (!firebaseUser) router.replace("/login");
    });
    return unsubscribe;
  }, [router, setUser, setLoading]);

  if (loading) return null;
  if (!user) return null;
  return <>{children}</>;
}
