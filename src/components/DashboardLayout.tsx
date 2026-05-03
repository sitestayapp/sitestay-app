import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MessageSquare, CalendarRange, Settings, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Conv = { id: string; title: string };

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState("starter");
  const [empresa, setEmpresa] = useState<string>("");
  const [convs, setConvs] = useState<Conv[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("plan, empresa").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setPlan(data.plan ?? "starter"); setEmpresa(data.empresa ?? ""); }
      });
    supabase.from("conversations").select("id, title").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30)
      .then(({ data }) => { if (data) setConvs(data); });
  }, [user]);

  const handleNew = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("conversations").insert({ user_id: user.id, title: "Nueva conversación" }).select().single();
    if (!error && data) {
      setConvs((c) => [{ id: data.id, title: data.title }, ...c]);
      navigate(`/dashboard/chat/${data.id}`);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <Link to="/dashboard" className="font-display text-xl font-bold">
            SiteStay<span className="text-primary">App</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1 truncate">{empresa || user?.email}</p>
        </div>

        <div className="p-3">
          <Button onClick={handleNew} className="w-full bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Nueva conversación
          </Button>
        </div>

        <nav className="px-3 space-y-1">
          <SidebarLink to="/dashboard/chat" icon={MessageSquare} label="Chat" />
          <SidebarLink to="/dashboard/reservations" icon={CalendarRange} label="Reservas" />
          <SidebarLink to="/dashboard/settings" icon={Settings} label="Ajustes" />
        </nav>

        <div className="px-3 mt-4 flex-1 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-2">Historial</div>
          <ul className="space-y-1">
            {convs.map((c) => (
              <li key={c.id}>
                <NavLink
                  to={`/dashboard/chat/${c.id}`}
                  className={({ isActive }) =>
                    `block truncate text-sm px-3 py-2 rounded-lg transition-colors ${
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                    }`
                  }
                >
                  {c.title}
                </NavLink>
              </li>
            ))}
            {convs.length === 0 && (
              <li className="text-xs text-muted-foreground px-2 py-2">Aún no hay conversaciones.</li>
            )}
          </ul>
        </div>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 py-2 rounded-lg bg-accent">
            <div className="text-xs text-muted-foreground">Plan activo</div>
            <div className="font-display font-semibold capitalize">{plan}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet context={{ refreshConvs: (title?: string, id?: string) => {
          if (id && title) setConvs((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
        } }} />
      </main>
    </div>
  );
}

function SidebarLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/dashboard/chat"}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
        }`
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </NavLink>
  );
}