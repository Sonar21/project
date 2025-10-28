"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireRole(role) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const userRole = session?.user?.role;
    if (!userRole) {
      router.push('/');
      return;
    }
    if (Array.isArray(role)) {
      if (!role.includes(userRole)) router.push('/');
    } else {
      if (userRole !== role) router.push('/');
    }
  }, [status, session, role, router]);
}
