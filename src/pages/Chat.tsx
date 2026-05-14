import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import OptionCard, { AccommodationOption } from "@/components/chat/OptionCard";
import CarCard, { CarOption } from "@/components/chat/CarCard";
import FlightCard, { FlightOption } from "@/components/chat/FlightCard";

type Kind = "accommodation" | "car" | "flight";
type Msg = { id?: string; role: "user" | "assistant"; content: string; options?: any[]; kind?: Kind };

const OPTIONS_MARKER_RE = /\n*<!--OPTIONS:(.*?)-->\n*/s;

function parseStored(content: string): { text: string; options?: any[]; kind?: Kind } {
  const m = content.match(OPTIONS_MARKER_RE);
  if (!m) return { text: content };
  try {
    const parsed = JSON.parse(m[1]);
    if (Array.isArray(parsed)) return { text: content.replace(OPTIONS_MARKER_RE, "").trim(), options: parsed, kind: "accommodation" };
    return { text: content.replace(OPTIONS_MARKER_RE, "").trim(), options: parsed.options, kind: parsed.kind };
  } catch {
    return { text: content };
  }
}

const SUGGESTIONS = [
  "Necesito un apartamento en Bilbao para 2 personas del 10 al 14 de junio, máx. 120€/noche.",
  "Hotel en Madrid centro, 3 noches, valoración mínima 8/10, con desayuno.",
  "Apartamento con cocina y lavadora en Lisboa, 1 persona, 7 noches.",
];

export default function Chat() {
  const { user } = useAuth();
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const ctx = useOutletContext<{ refreshConvs: (title?: string, id?: string) => void }>();

  const [conversationId, setConversationId] = useState<string | null>(routeId ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setConversationId(routeId ?? null); }, [routeId]);

  useEffect(() => {
    if (!conversationId || !user) { setMessages([]); return; }
    supabase.from("messages").select("id, role, content").eq("conversation_id", conversationId).order("created_at")
      .then(({ data }) => {
        if (data) {
          setMessages(
            data.map((d: any) => {
              const parsed = parseStored(d.content ?? "");
              return { id: d.id, role: d.role, content: parsed.text, options: parsed.options, kind: parsed.kind };
            }),
          );
        }
      });
  }, [conversationId, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || !user || loading) return;
    setLoading(true);

    let cid = conversationId;
    let isNew = false;
    if (!cid) {
      const title = text.slice(0, 50);
      const { data, error } = await supabase.from("conversations").insert({ user_id: user.id, title }).select().single();
      if (error || !data) { toast.error("No se pudo crear la conversación"); setLoading(false); return; }
      cid = data.id;
      isNew = true;
      setConversationId(cid);
      navigate(`/dashboard/chat/${cid}`, { replace: true });
    }

    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg, { role: "assistant", content: "", options: undefined, kind: undefined }]);
    setInput("");

    await supabase.from("messages").insert({ conversation_id: cid, user_id: user.id, role: "user", content: text });
    if (isNew) ctx.refreshConvs(text.slice(0, 50), cid);

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      const { data: { session } } = await supabase.auth.getSession();
      const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpYWNmeXR5bWZ0YXZneWR2eGFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTY1NDAsImV4cCI6MjA5Mzk5MjU0MH0.NpJrJZrTTLHW7U_S1hG03CRkbtYLJGjuFDwbjcUlOhI";
      const token = session?.access_token ?? ANON_KEY;
      const url = "https://yiacfytymftavgydvxaa.supabase.co/functions/v1/chat";
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error al contactar con el agente");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";
      let assistantOptions: any[] | undefined;
      let assistantKind: Kind | undefined;
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const evt = JSON.parse(data);
            if (evt.delta) {
              assistantText += evt.delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistantText, options: assistantOptions, kind: assistantKind };
                return copy;
              });
            }
            if (evt.options) {
              assistantOptions = evt.options;
              if (evt.kind) assistantKind = evt.kind;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: assistantText, options: assistantOptions, kind: assistantKind };
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }

      if (assistantText) {
        const stored = assistantOptions
          ? `${assistantText}\n\n<!--OPTIONS:${JSON.stringify({ options: assistantOptions, kind: assistantKind ?? "accommodation" })}-->`
          : assistantText;
        await supabase.from("messages").insert({
          conversation_id: cid, user_id: user.id, role: "assistant", content: stored,
        });
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", cid);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Error en la conversación");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const chooseAccommodation = (opt: AccommodationOption, index: number) => {
    const total = opt.price_total ? ` (total ${Math.round(opt.price_total)}€)` : "";
    const pn = opt.price_per_night ? ` a ${Math.round(opt.price_per_night)}€/noche${total}` : "";
    send(`Elijo opción ${index + 1}: ${opt.name}${pn}. Procede a reservar.`);
  };
  const chooseCar = (opt: CarOption, index: number) => {
    const total = opt.price_total ? ` (total ${Math.round(opt.price_total)}€)` : "";
    send(`Elijo coche ${index + 1}: ${opt.model}${opt.company ? ` de ${opt.company}` : ""}${total}. Procede.`);
  };
  const chooseFlight = (opt: FlightOption, index: number) => {
    const price = opt.price_label ?? (opt.price_total ? `${Math.round(opt.price_total)}€` : "");
    send(`Elijo vuelo ${index + 1}: ${opt.airline} ${opt.origin}→${opt.destination} ${opt.depart_time}${price ? ` (${price})` : ""}. Procede.`);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen">
      <header className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display font-semibold">NomadDesk</h1>
            <p className="text-xs text-muted-foreground">Agente de reservas corporativas</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {isEmpty && (
            <div className="text-center py-12">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">¿Qué reservamos hoy?</h2>
              <p className="text-muted-foreground mb-8">Cuéntale a NomadDesk ciudad, fechas, personas y presupuesto.</p>
              <div className="grid sm:grid-cols-3 gap-3 text-left">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)}
                    className="text-sm p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-soft transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col gap-3 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border shadow-soft"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed [&_p]:my-1">
                    <ReactMarkdown>{m.content || (loading && i === messages.length - 1 ? "…" : "")}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{m.content}</pre>
                )}
              </div>
              {m.options && m.options.length > 0 && (
                <div className="w-full max-w-[95%] grid gap-3">
                  {m.options.map((opt: any, idx: number) => {
                    const k = m.kind ?? "accommodation";
                    if (k === "car") return <CarCard key={opt.id ?? idx} option={opt} index={idx} onChoose={chooseCar} disabled={loading} />;
                    if (k === "flight") return <FlightCard key={opt.id ?? idx} option={opt} index={idx} onChoose={chooseFlight} disabled={loading} />;
                    return <OptionCard key={opt.id ?? idx} option={opt} index={idx} onChoose={chooseAccommodation} disabled={loading} />;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-card/50 p-4">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
              }}
              placeholder="Pídele a NomadDesk una reserva… (Enter para enviar, Shift+Enter para salto de línea)"
              rows={2}
              className="resize-none bg-background"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} className="bg-primary hover:bg-primary/90 h-auto py-3">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}