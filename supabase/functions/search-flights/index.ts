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

const ES_TO_EN: Record<string, string> = {
  "berlín": "Berlin", "berlin": "Berlin",
  "parís": "Paris", "paris": "Paris",
  "londres": "London",
  "roma": "Rome",
  "milán": "Milan", "milan": "Milan",
  "lisboa": "Lisbon",
  "viena": "Vienna",
  "atenas": "Athens",
  "moscú": "Moscow",
  "estocolmo": "Stockholm",
  "copenhague": "Copenhagen",
  "ginebra": "Geneva",
  "zúrich": "Zurich", "zurich": "Zurich",
  "praga": "Prague",
  "bruselas": "Brussels",
  "ámsterdam": "Amsterdam", "amsterdam": "Amsterdam",
  "nueva york": "New York",
  "tokio": "Tokyo",
  "pekín": "Beijing", "pequín": "Beijing",
};

async function tryAirport(key: string, query: string, locale: string) {
  const u = new URL(`https://${HOST}/api/v1/flights/searchAirport`);
  u.searchParams.set("query", query);
  u.searchParams.set("locale", locale);
  const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST } });
  if (!r.ok) return null;
  const j = await r.json();
  console.log(`[flights] airport "${query}" (${locale}) FULL:`, JSON.stringify(j).slice(0, 800));
  const list: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
  for (const it of list) {
    const skyId = it?.skyId ?? it?.navigation?.relevantFlightParams?.skyId;
    const entityId = it?.entityId ?? it?.navigation?.entityId ?? it?.navigation?.relevantFlightParams?.entityId;
    if (skyId && entityId) {
      return { skyId: String(skyId), entityId: String(entityId), name: it?.presentation?.title ?? query };
    }
  }
  return null;
}

async function airport(key: string, query: string) {
  let found = await tryAirport(key, query, "es-ES");
  if (found) return found;
  // Fallback: English locale
  found = await tryAirport(key, query, "en-US");
  if (found) return found;
  // Fallback: translate Spanish city → English name
  const en = ES_TO_EN[query.trim().toLowerCase()];
  if (en && en.toLowerCase() !== query.trim().toLowerCase()) {
    console.log(`[flights] retrying with English name: ${en}`);
    found = await tryAirport(key, en, "en-US");
    if (found) return found;
  }
  throw new Error(`Sin aeropuerto para "${query}"`);
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

    const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "";
    const fmtDur = (m?: number) => m ? `${Math.floor(m / 60)}h ${m % 60}m` : "";

    // ---------- PRIMARY: sky-scrapper ----------
    const trySkyScrapper = async (): Promise<any[]> => {
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
      if (!r.ok) throw new Error(`sky-scrapper ${r.status}`);
      const j = await r.json();
      const its = j?.data?.itineraries ?? j?.itineraries ?? [];
      if (!Array.isArray(its) || its.length === 0) throw new Error("sky-scrapper vacío");
      return its.slice(0, 6).map((it: any) => {
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
    };

    // ---------- FALLBACK 1: priceline-com2 ----------
    const tryPriceline = async (): Promise<any[]> => {
      const HOST_P = "priceline-com2.p.rapidapi.com";
      const path = input.fecha_vuelta ? "/flights/search-roundtrip" : "/flights/search-oneway";
      const u = new URL(`https://${HOST_P}${path}`);
      u.searchParams.set("origin", input.origen);
      u.searchParams.set("destination", input.destino);
      u.searchParams.set("departureDate", input.fecha_salida);
      if (input.fecha_vuelta) u.searchParams.set("returnDate", input.fecha_vuelta);
      u.searchParams.set("adults", String(adults));
      u.searchParams.set("currency", "EUR");
      const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_P } });
      if (!r.ok) throw new Error(`priceline flights ${r.status}`);
      const j = await r.json();
      const list = j?.data?.itineraries ?? j?.data?.results ?? j?.itineraries ?? j?.results ?? [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("priceline flights vacío");
      return list.slice(0, 6).map((it: any) => {
        const segs = it?.slices?.[0]?.segments ?? it?.segments ?? [];
        const first = segs[0] ?? {};
        const last = segs[segs.length - 1] ?? first;
        const back = it?.slices?.[1]?.segments ?? null;
        return {
          id: String(it?.id ?? crypto.randomUUID()),
          airline: first?.carrier?.name ?? first?.airline ?? "Aerolínea",
          airline_logo: first?.carrier?.logo ?? null,
          origin: first?.origin?.code ?? input.origen,
          destination: last?.destination?.code ?? input.destino,
          depart_time: fmtTime(first?.departureTime),
          arrive_time: fmtTime(last?.arrivalTime),
          duration: fmtDur(it?.slices?.[0]?.duration ?? it?.duration),
          stops: Math.max(0, segs.length - 1),
          return_depart_time: back?.[0] ? fmtTime(back[0]?.departureTime) : null,
          return_arrive_time: back ? fmtTime(back[back.length - 1]?.arrivalTime) : null,
          return_duration: back ? fmtDur(it?.slices?.[1]?.duration) : null,
          return_stops: back ? Math.max(0, back.length - 1) : null,
          price_total: it?.price?.total ?? it?.totalPrice ?? null,
          price_label: it?.price?.formatted ?? (it?.price?.total ? `€${it.price.total}` : null),
          currency: "EUR",
          date: input.fecha_salida,
          return_date: input.fecha_vuelta ?? null,
          url: it?.deepLink ?? null,
        };
      });
    };

    // ---------- FALLBACK 2: expedia13 ----------
    const tryExpedia = async (): Promise<any[]> => {
      const HOST_E = "expedia13.p.rapidapi.com";
      const u = new URL(`https://${HOST_E}/api/v1/flights/searchFlights`);
      u.searchParams.set("origin", input.origen);
      u.searchParams.set("destination", input.destino);
      u.searchParams.set("departureDate", input.fecha_salida);
      if (input.fecha_vuelta) u.searchParams.set("returnDate", input.fecha_vuelta);
      u.searchParams.set("adults", String(adults));
      u.searchParams.set("currency", "EUR");
      const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_E } });
      if (!r.ok) throw new Error(`expedia flights ${r.status}`);
      const j = await r.json();
      const list = j?.data?.flights ?? j?.data?.results ?? j?.flights ?? j?.results ?? [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("expedia flights vacío");
      return list.slice(0, 6).map((it: any) => {
        const segs = it?.segments ?? it?.legs?.[0]?.segments ?? [];
        const first = segs[0] ?? {};
        const last = segs[segs.length - 1] ?? first;
        return {
          id: String(it?.id ?? crypto.randomUUID()),
          airline: first?.airlineName ?? first?.carrier?.name ?? "Aerolínea",
          airline_logo: first?.airlineLogo ?? null,
          origin: first?.departureAirport?.code ?? input.origen,
          destination: last?.arrivalAirport?.code ?? input.destino,
          depart_time: fmtTime(first?.departureTime),
          arrive_time: fmtTime(last?.arrivalTime),
          duration: fmtDur(it?.duration ?? it?.totalDuration),
          stops: Math.max(0, segs.length - 1),
          return_depart_time: null, return_arrive_time: null, return_duration: null, return_stops: null,
          price_total: it?.price?.total ?? it?.totalPrice ?? null,
          price_label: it?.price?.formatted ?? (it?.price?.total ? `€${it.price.total}` : null),
          currency: "EUR",
          date: input.fecha_salida,
          return_date: input.fecha_vuelta ?? null,
          url: it?.deepLink ?? null,
        };
      });
    };

    const providers: Array<[string, () => Promise<any[]>]> = [
      ["sky-scrapper", trySkyScrapper],
      ["priceline-com2", tryPriceline],
      ["expedia13", tryExpedia],
    ];
    let items: any[] = [];
    for (const [name, fn] of providers) {
      try {
        items = await fn();
        if (items.length > 0) {
          console.log(`[flights] ✅ provider responded: ${name} (${items.length} results)`);
          break;
        }
      } catch (e) {
        console.warn(`[flights] ${name} failed:`, e instanceof Error ? e.message : e);
      }
    }
    if (items.length === 0) {
      return new Response(JSON.stringify({ results: [], error: "No hay vuelos disponibles en este momento." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ results: items }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("flights error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});