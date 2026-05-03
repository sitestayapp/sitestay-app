import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [empresa, setEmpresa] = useState("");
  const [cif, setCif] = useState("");
  const [plan, setPlan] = useState("starter");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("empresa, cif, plan").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setEmpresa(data.empresa ?? ""); setCif(data.cif ?? ""); setPlan(data.plan ?? "starter"); }
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ empresa, cif }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Datos guardados");
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-bold mb-6">Ajustes</h1>

      <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl font-semibold">Datos de la empresa</h2>
        <div>
          <Label htmlFor="empresa">Nombre de empresa</Label>
          <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cif">CIF (para facturas)</Label>
          <Input id="cif" value={cif} onChange={(e) => setCif(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90">
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </form>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-xl font-semibold mb-2">Plan</h2>
        <p className="text-sm text-muted-foreground mb-3">Plan actual: <span className="font-medium capitalize text-foreground">{plan}</span></p>
        <p className="text-xs text-muted-foreground">La gestión de facturación y cambio de plan se habilitará en la fase 2.</p>
      </div>
    </div>
  );
}