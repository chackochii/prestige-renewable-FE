// /logout — clears the session and sends the person to sign-in.

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";

export default function LogoutPage() {
  const { isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (isAuthenticated) logout();
  }, [isAuthenticated, logout]);

  if (isAuthenticated) return <LoadingState screen label="Signing out…" />;
  return <Navigate to="/login" replace />;
}
