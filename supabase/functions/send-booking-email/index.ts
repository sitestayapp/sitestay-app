import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRIMARY_FROM = "SiteStayApp <reservas@sitestayapp.com>";
const FALLBACK_FROM = "SiteStayApp <onboarding@resend.dev>";

function fmtDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return s; }
}

function buildHtml(p: any) {
  const photo = p.photo
    ? `<img src="${p.photo}" alt="${p.alojamiento}" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px 12px 0 0;display:block"/>`
    : "";
  const url = p.url || "#";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F5F2EB;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;font-size:22px;font-weight:700;color:#15803d;letter-spacing:-0.5px">SiteStayApp</div>
    </div>
    <h1 style="font-size:22px;margin:0 0 8px">Hola ${p.trabajador_nombre || ""},</h1>
    <p style="margin:0 0 24px;color:#4b5563;line-height:1.5">Tu alojamiento corporativo en <strong>${p.ciudad}</strong> está confirmado. Aquí tienes los detalles:</p>

    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      ${photo}
      <div style="padding:20px">
        <div style="font-size:18px;font-weight:600;margin-bottom:6px">${p.alojamiento}</div>
        ${p.address ? `<div style="color:#6b7280;font-size:14px;margin-bottom:16px">${p.address}</div>` : ""}
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr>
            <td style="padding:6px 0;color:#6b7280">Check-in</td>
            <td style="padding:6px 0;text-align:right;font-weight:600">${fmtDate(p.fecha_inicio)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280">Check-out</td>
            <td style="padding:6px 0;text-align:right;font-weight:600">${fmtDate(p.fecha_fin)}</td>
          </tr>
          ${p.precio ? `<tr><td style="padding:6px 0;color:#6b7280">Precio total</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#15803d">${Math.round(p.precio)}€</td></tr>` : ""}
        </table>
      </div>
    </div>

    <div style="text-align:center;margin:28px 0">
      <a href="${url}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px">Ver reserva en Booking</a>
    </div>

    <p style="background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:12px 16px;border-radius:8px;font-size:13px;margin:0 0 24px">
      La factura corporativa será emitida automáticamente.
    </p>

    <div style="text-align:center;color:#9ca3af;font-size:12px;margin-top:32px">
      sitestayapp.com
    </div>
  </div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payload = await req.json();
    const {
      trabajador_nombre, trabajador_contacto, ciudad, alojamiento,
      fecha_inicio, fecha_fin, precio, address, photo, url,
    } = payload;

    if (!trabajador_contacto) {
      return new Response(JSON.stringify({ error: "Falta trabajador_contacto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `Tu alojamiento en ${ciudad} — ${fmtDate(fecha_inicio)} al ${fmtDate(fecha_fin)}`;
    const html = buildHtml({ trabajador_nombre, ciudad, alojamiento, fecha_inicio, fecha_fin, precio, address, photo, url });

    async function send(from: string) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from, to: [trabajador_contacto], subject, html }),
      });
      return { r, data: await r.json() };
    }

    let { r: res, data } = await send(PRIMARY_FROM);
    console.log("[send-booking-email] primary status", res.status, data);
    if (!res.ok) {
      const msg = (data?.message || "").toString().toLowerCase();
      const domainIssue = res.status === 403 || msg.includes("domain") || msg.includes("verify") || msg.includes("not verified");
      if (domainIssue) {
        console.warn("[send-booking-email] primary failed, falling back to onboarding@resend.dev");
        ({ r: res, data } = await send(FALLBACK_FROM));
        console.log("[send-booking-email] fallback status", res.status, data);
      }
    }
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.message || "Resend error", details: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-booking-email] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});