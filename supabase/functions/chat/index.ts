import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
- Busca primero en TravelPerk [AUTO].
- Si menos de 3 opciones, amplía a Booking y Airbnb [MANUAL].
- Avisa si hay opciones MANUAL.

FORMATO DE OPCIONES:
Opción 1 — [nombre] [AUTO/MANUAL]
- Precio: X€/noche (total X€)
- Valoración: X/10
- Cancelación: gratuita/no reembolsable
- Equipamiento: cocina/lavadora/wifi/parking
- Factura corporativa: sí/no
- Ubicación: descripción breve

CONFIRMACIÓN:
- Pide confirmación antes de reservar.
- Incluye siempre: Se solicitará factura corporativa.

ENVÍO AL TRABAJADOR:
- Tras confirmar, pide nombre y contacto del trabajador.
- Genera mensaje listo para copiar y enviar por WhatsApp o email.`;

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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
        stream: true,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Anthropic error", response.status, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Inténtalo en un momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Error del modelo de IA", status: response.status, detail: text }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Anthropic SSE to a simple text/event-stream of {delta: "..."} JSON events.
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data) continue;
              try {
                const evt = JSON.parse(data);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: evt.delta.text })}\n\n`));
                } else if (evt.type === "message_stop") {
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                }
              } catch { /* ignore */ }
            }
          }
        } catch (e) {
          console.error("stream error", e);
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