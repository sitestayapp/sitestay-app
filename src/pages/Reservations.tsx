import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Reservation = {
  id: string;
  ciudad: string | null;
  alojamiento: string | null;
  precio: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  trabajador_nombre: string | null;
  trabajador_contacto: string | null;
  estado: string;
  factura_solicitada: boolean;
  created_at: string;
};

const ESTADOS = ["pendiente", "confirmada", "cancelada", "completada"];

export default function Reservations() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<string>("todas");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as Reservation[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const updateEstado = async (id: string, estado: string) => {
    const { error } = await supabase.from("reservations").update({ estado }).eq("id", id);
    if (error) toast.error(error.message);
    else setRows((r) => r.map((x) => (x.id === id ? { ...x, estado } : x)));
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta reserva?")) return;
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setRows((r) => r.filter((x) => x.id !== id));
  };

  const filtered = filter === "todas" ? rows : rows.filter((r) => r.estado === filter);

  const exportCsv = () => {
    const headers = ["ciudad", "alojamiento", "precio", "fecha_inicio", "fecha_fin", "trabajador_nombre", "trabajador_contacto", "estado", "factura_solicitada", "created_at"];
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [
      headers.join(","),
      ...filtered.map((r) => headers.map((h) => escape((r as any)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Reservas</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} reserva(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={exportCsv} variant="outline" disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ciudad</TableHead>
              <TableHead>Alojamiento</TableHead>
              <TableHead>Fechas</TableHead>
              <TableHead>Trabajador</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Factura</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Cargando…</TableCell></TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                Aún no hay reservas. Pídele una a NomadDesk en el chat.
              </TableCell></TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.ciudad}</TableCell>
                <TableCell>{r.alojamiento}</TableCell>
                <TableCell className="text-sm">{r.fecha_inicio} → {r.fecha_fin}</TableCell>
                <TableCell className="text-sm">
                  <div>{r.trabajador_nombre}</div>
                  <div className="text-muted-foreground text-xs">{r.trabajador_contacto}</div>
                </TableCell>
                <TableCell className="text-right">{r.precio ? `${r.precio} €` : "—"}</TableCell>
                <TableCell>
                  <Select value={r.estado} onValueChange={(v) => updateEstado(r.id, v)}>
                    <SelectTrigger className="h-8 w-[130px] capitalize"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm">{r.factura_solicitada ? "Sí" : "No"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}