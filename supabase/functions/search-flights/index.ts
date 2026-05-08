import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOST = "sky-scrapper.p.rapidapi.com";

type In = {
  origen: string;
  destino: string;
  fecha_salida: string;     // YYYY-MM-DD
  fecha_vuelta?: string;    // YYYY-MM-DD
  adultos?: number;
};

async function airport(key: string, query: string) {
  const u = new URL(`https://${HOST}/api/v1/flights/searchAirport`);
  u.searchParams.set("query", query);
  u.searchParams.set("locale", "es-ES");
  const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST } });
  if (!r.ok) throw new Error(`Airport ${query} ${r.status}`);
  const j = await r.json();
  console.log(`[flights] airport ${query} sample:`, JSON.stringify(j).slice(0, 300));
  const first = j?.data?.[0] ?? j?.[0];
  const skyId = first?.skyId ?? first?.navigation?.relevantFlightParams?.skyId;
  const entityId = first?.entityId ?? first?.navigation?.entityId ?? first?.navigation?.relevantFlightParams?.entityId;
  if (!skyId || !entityId) throw new Error(`Sin aeropuerto para "${query}"`);
  return { skyId: String(skyId), entityId: String(entityId), name: first?.presentation?.title ?? query };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RAPIDAPI_KEY");
    if (!key) return new Response(JSON.stringify({ error: "RAPIDAPI_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const input = (await req.json()) as In;
    if (!input?.origen || !input?.destino || !input?.fecha_salida) {
      return new Response(JSON.stringify({ error: "Faltan parámetros: origen, destino, fecha_salida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const adults = input.adultos ?? 1;

    const [from, to] = await Promise.all([airport(key, input.origen), airport(key, input.destino)]);

    const u = new URL(`https://${HOST}/api/v1/flights/searchFlights`);
    u.searchParams.set("originSkyId", from.skyId);
    u.searchParams.set("destinationSkyId", to.skyId);
    u.searchParams.set("originEntityId", from.entityId);
    u.searchParams.set("destinationEntityId", to.entityId);
    u.searchParams.set("date", input.fecha_salida);
    if (input.fecha_vuelta) u.searchParams.set("returnDate", input.fecha_vuelta);
    u.searchParams.set("adults", String(adults));
    u.searchParams.set("currency", "EUR");
    u.searchParams.set("market", "es-ES");
    u.searchParams.set("countryCode", "ES");

    const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST } });
    if (!r.ok) throw new Error(`Flights ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    const its = j?.data?.itineraries ?? j?.itineraries ?? [];
    console.log(`[flights] found: ${Array.isArray(its) ? its.length : 0}`);

    const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";
    const fmtDur = (m?: number) => m ? `${Math.floor(m / 60)}h ${m % 60}m` : "";

    const items = (Array.isArray(its) ? its : []).slice(0, 6).map((it: any) => {
      const legs = it?.legs ?? [];
      const out = legs[0] ?? {};
      const back = legs[1];
      const carrier = out?.carriers?.marketing?.[0] ?? {};
      return {
        id: String(it?.id ?? crypto.randomUUID()),
        airline: carrier?.name ?? "Aerolínea",
        airline_logo: carrier?.logoUrl ?? null,
        origin: out?.origin?.displayCode ?? from.skyId,
        destination: out?.destination?.displayCode ?? to.skyId,
        depart_time: fmtTime(out?.departure),
        arrive_time: fmtTime(out?.arrival),
        duration: fmtDur(out?.durationInMinutes),
        stops: out?.stopCount ?? 0,
        return_depart_time: back ? fmtTime(back?.departure) : null,
        return_arrive_time: back ? fmtTime(back?.arrival) : null,
        return_duration: back ? fmtDur(back?.durationInMinutes) : null,
        return_stops: back ? back?.stopCount ?? 0 : null,
        price_total: it?.price?.raw ?? null,
        price_label: it?.price?.formatted ?? null,
        currency: "EUR",
        date: input.fecha_salida,
        return_date: input.fecha_vuelta ?? null,
        url: null,
      };
    });

    return new Response(JSON.stringify({ results: items }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("flights error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});