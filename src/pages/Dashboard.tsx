import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CalendarRange, Wallet, Plane, MessageSquare, ArrowRight } from "lucide-react";

type Reservation = {
  id: string;
  ciudad: string | null;
  alojamiento: string | null;
  precio: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  trabajador_nombre: string | null;
  estado: string;
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reservations")
      .select("id, ciudad, alojamiento, precio, fecha_inicio, fecha_fin, trabajador_nombre, estado")
      .eq("user_id", user.id)
      .order("fecha_inicio", { ascending: true })
      .then(({ data }) => {
        setRows((data as Reservation[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { activas, gastoMes, proxima } = useMemo(() => {
    const activas = rows.filter(
      (r) => r.estado === "confirmada" && (!r.fecha_fin || new Date(r.fecha_fin) >= now),
    );
    const gastoMes = rows
      .filter((r) => r.fecha_inicio && new Date(r.fecha_inicio) >= startOfMonth)
      .reduce((s, r) => s + (Number(r.precio) || 0), 0);
    const proxima = activas
      .filter((r) => r.fecha_inicio && new Date(r.fecha_inicio) >= now)
      .sort((a, b) => +new Date(a.fecha_inicio!) - +new Date(b.fecha_inicio!))[0];
    return { activas, gastoMes, proxima };
  }, [rows]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Resumen</h1>
          <p className="text-muted-foreground text-sm">Bienvenido de vuelta, {user?.email}</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/dashboard/chat"><MessageSquare className="h-4 w-4 mr-2" /> Nueva reserva</Link>
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <MetricCard icon={CalendarRange} label="Reservas activas" value={String(activas.length)} hint="confirmadas y vigentes" />
        <MetricCard icon={Wallet} label="Gasto del mes" value={`${gastoMes.toFixed(0)} €`} hint={now.toLocaleDateString("es-ES", { month: "long" })} />
        <MetricCard
          icon={Plane}
          label="Próximo check-in"
          value={proxima ? fmtDate(proxima.fecha_inicio) : "—"}
          hint={proxima ? `${proxima.ciudad} · ${proxima.trabajador_nombre ?? "—"}` : "Sin próximas reservas"}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">Reservas activas</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/reservations">Ver todas <ArrowRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : activas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground mb-3">Aún no tienes reservas activas.</p>
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/dashboard/chat">Pedirle una a NomadDesk</Link>
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {activas.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-elegant transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-wider text-primary font-semibold">{r.ciudad}</div>
                    <div className="font-display font-semibold mt-1 truncate">{r.alojamiento ?? "—"}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {fmtDate(r.fecha_inicio)} → {fmtDate(r.fecha_fin)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{r.trabajador_nombre ?? "—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-lg font-bold">{r.precio ? `${Math.round(Number(r.precio))} €` : "—"}</div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {r.estado}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" /> {label}
      </div>
      <div className="font-display text-3xl font-bold mt-2">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}