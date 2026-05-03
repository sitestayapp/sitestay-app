import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { empresa },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu correo si pide confirmación.");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Error de autenticación");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-gradient-hero text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="font-display text-2xl font-bold">SiteStayApp</Link>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight mb-4">
            {mode === "register" ? "Empieza a reservar como un equipo serio." : "Bienvenido de vuelta."}
          </h2>
          <p className="opacity-80 max-w-md">
            NomadDesk se encarga de la búsqueda, la factura corporativa y el mensaje al trabajador. Tú solo apruebas.
          </p>
        </div>
        <div className="text-xs opacity-60">© {new Date().getFullYear()} SiteStayApp</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link to="/" className="md:hidden font-display text-xl font-bold mb-6 inline-block">SiteStayApp</Link>
          <h1 className="font-display text-3xl font-bold mb-2">
            {mode === "register" ? "Crea tu cuenta" : "Inicia sesión"}
          </h1>
          <p className="text-muted-foreground mb-6 text-sm">
            {mode === "register" ? "Plan Starter incluido. Sin tarjeta." : "Accede a tu panel y conversaciones."}
          </p>
          <form onSubmit={handle} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="empresa">Empresa</Label>
                <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90">
              {submitting ? "..." : mode === "register" ? "Crear cuenta" : "Entrar"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground text-center">
            {mode === "register" ? (
              <>¿Ya tienes cuenta? <Link to="/login" className="text-primary font-medium">Inicia sesión</Link></>
            ) : (
              <>¿Nuevo aquí? <Link to="/register" className="text-primary font-medium">Crea una cuenta</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}