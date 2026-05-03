import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}