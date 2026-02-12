"use client";

import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { Loader2 } from "lucide-react";

export default function Page() {
  const { isAuthenticated, isLoading, currentCompany } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        if (currentCompany) {
          // Redirect to company dashboard
          window.location.href = `/dashboard/${currentCompany.company.id}/overview`;
        } else {
          // Redirect to company selection
          window.location.href = "/dashboard/select-company";
        }
      } else {
        // Redirect to sign in
        window.location.href = "/auth/sign-in";
      }
    }
  }, [isAuthenticated, isLoading, currentCompany]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}