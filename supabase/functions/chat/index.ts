import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres NomadDesk, un agente especializado en reservas de alojamiento corporativo para empresas con equipos móviles.

COMPORTAMIENTO:
- Extrae: ciudad, personas, fechas, presupuesto, requisitos.
- Si falta info crítica, pregunta solo lo imprescindible.
- Responde en el idioma del admin.

DETECCIÓN TIPO ALOJAMIENTO:
- Si menciona apartamento o hotel, úsalo directamente.
- Si no lo menciona, pregunta: ¿Necesitas apartamento o hotel?

APARTAMENTO: filtra por cocina, lavadora, habitaciones, precio.
HOTEL: filtra por estrellas, desayuno, ubicación, valoración mínima 8/10.

FACTURA CORPORATIVA:
- Solicitar siempre en todas las reservas automáticamente.
- Indicarlo en la confirmación y en el mensaje al trabajador.

BÚSQUEDA:
- Cuando tengas ciudad y fechas, llama a la herramienta buscar_alojamientos.
- Presenta entre 3 y 5 opciones reales en el formato indicado.
- No inventes precios ni alojamientos: usa solo los devueltos por la herramienta.
- Si la herramienta devuelve un campo "error", muéstralo literalmente al usuario (no digas "sin disponibilidad"). Ejemplo: "Error en la búsqueda: <texto>".
- Solo di "no hay resultados" si la herramienta devuelve "results": [] explícitamente vacío.

FORMATO DE OPCIONES:
Opción 1 — [nombre]
- Precio: X€/noche (total X€)
- Valoración: X/10
- Cancelación: gratuita/no reembolsable
- Enlace: URL
- Factura corporativa: sí

CONFIRMACIÓN:
- Pide confirmación con número de opción.
- Tras confirmar, solicita NOMBRE y CONTACTO del trabajador (email o WhatsApp).
- Cuando tengas opción confirmada + datos del trabajador, llama a la herramienta crear_reserva.
- Confirma a continuación: "Reserva guardada. Se solicitará factura corporativa."

ENVÍO AL TRABAJADOR:
- Tras crear la reserva, genera un mensaje listo para copiar (WhatsApp/email) con: alojamiento, ciudad, fechas, dirección/enlace y nota de que la factura corporativa va incluida.`;

const TOOLS = [
  {
    name: "buscar_alojamientos",
    description: "Busca alojamientos reales (hoteles o apartamentos) en Booking para una ciudad y fechas.",
    input_schema: {
      type: "object",
      properties: {
        ciudad: { type: "string" },
        check_in: { type: "string", description: "YYYY-MM-DD" },
        check_out: { type: "string", description: "YYYY-MM-DD" },
        adultos: { type: "number" },
        tipo: { type: "string", enum: ["hotel", "apartamento"] },
        max_precio: { type: "number", description: "Precio máximo por noche en EUR" },
      },
      required: ["ciudad", "check_in", "check_out"],
    },
  },
  {
    name: "crear_reserva",
    description: "Crea una reserva en la base de datos del usuario tras la confirmación. La factura corporativa se solicita siempre.",
    input_schema: {
      type: "object",
      properties: {
        ciudad: { type: "string" },
        alojamiento: { type: "string" },
        precio: { type: "number", description: "Precio total en EUR" },
        fecha_inicio: { type: "string", description: "YYYY-MM-DD" },
        fecha_fin: { type: "string", description: "YYYY-MM-DD" },
        trabajador_nombre: { type: "string" },
        trabajador_contacto: { type: "string" },
      },
      required: ["ciudad", "alojamiento", "fecha_inicio", "fecha_fin", "trabajador_nombre", "trabajador_contacto"],
    },
  },
];

async function runTool(name: string, input: any, ctx: { userId: string | null; authHeader: string | null }) {
  if (name === "buscar_alojamientos") {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-accommodations`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ctx.authHeader ?? `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    console.log("[chat] buscar_alojamientos status:", res.status, "count:", Array.isArray(json?.results) ? json.results.length : "n/a", "error:", json?.error ?? null);
    return { text: JSON.stringify(json).slice(0, 12000), options: Array.isArray(json?.results) ? json.results.slice(0, 5) : [] };
  }
  if (name === "crear_reserva") {
    if (!ctx.userId) return { text: JSON.stringify({ error: "Usuario no autenticado" }) };
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supa.from("reservations").insert({
      user_id: ctx.userId,
      ciudad: input.ciudad,
      alojamiento: input.alojamiento,
      precio: input.precio ?? null,
      fecha_inicio: input.fecha_inicio,
      fecha_fin: input.fecha_fin,
      trabajador_nombre: input.trabajador_nombre,
      trabajador_contacto: input.trabajador_contacto,
      estado: "confirmada",
      factura_solicitada: true,
    }).select().single();
    if (error) return { text: JSON.stringify({ error: error.message }) };

    // Fire-and-forget email to worker via send-transactional-email
    try {
      const emailRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          templateName: "booking-confirmation",
          recipientEmail: input.trabajador_contacto,
          idempotencyKey: `booking-${data.id}`,
          templateData: {
            name: input.trabajador_nombre,
            ciudad: input.ciudad,
            alojamiento: input.alojamiento,
            fecha_inicio: input.fecha_inicio,
            fecha_fin: input.fecha_fin,
            precio: input.precio,
          },
        }),
      });
      console.log("[chat] email send status:", emailRes.status);
    } catch (e) {
      console.error("[chat] email send failed", e);
    }

    return { text: JSON.stringify({ ok: true, id: data.id }) };
  }
  return { text: JSON.stringify({ error: "Herramienta desconocida" }) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identify user from JWT (for crear_reserva).
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      try {
        const supa = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data } = await supa.auth.getUser();
        userId = data.user?.id ?? null;
      } catch { /* ignore */ }
    }

    const convo: any[] = messages.map((m: any) => ({ role: m.role, content: m.content }));
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (delta: string) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        const sendEvent = (obj: any) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          for (let turn = 0; turn < 6; turn++) {
            const res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-5-20250929",
                max_tokens: 2048,
                system: SYSTEM_PROMPT,
                tools: TOOLS,
                messages: convo,
              }),
            });
            if (!res.ok) {
              const text = await res.text();
              console.error("Anthropic error", res.status, text);
              send(`\n\n_Error del modelo: ${res.status}_`);
              break;
            }
            const data = await res.json();
            const blocks = data?.content ?? [];

            // Emit text blocks token-by-line; also collect tool_use blocks
            const toolUses: any[] = [];
            for (const b of blocks) {
              if (b.type === "text" && b.text) send(b.text);
              else if (b.type === "tool_use") toolUses.push(b);
            }

            convo.push({ role: "assistant", content: blocks });

            if (data.stop_reason !== "tool_use" || toolUses.length === 0) break;

            const toolResults = [];
            for (const tu of toolUses) {
              const result: any = await runTool(tu.name, tu.input, { userId, authHeader });
              if (result?.options && Array.isArray(result.options) && result.options.length) {
                sendEvent({ options: result.options });
              }
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: typeof result === "string" ? result : result.text,
              });
            }
            convo.push({ role: "user", content: toolResults });
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (e) {
          console.error("loop error", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});