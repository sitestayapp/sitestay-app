import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SearchInput = {
  ciudad: string;
  check_in: string; // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
  adultos?: number;
  tipo?: "hotel" | "apartamento";
  max_precio?: number;
};

async function searchBooking(key: string, q: SearchInput) {
  const adults = q.adultos ?? 1;
  console.log("[search] input:", JSON.stringify(q));
  // 1) Resolve destination
  const destUrl = new URL("https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination");
  destUrl.searchParams.set("query", q.ciudad);
  const destRes = await fetch(destUrl, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": "booking-com15.p.rapidapi.com" },
  });
  if (!destRes.ok) {
    const t = await destRes.text();
    console.error("[search] dest error", destRes.status, t);
    throw new Error(`Booking dest ${destRes.status}: ${t.slice(0, 200)}`);
  }
  const destJson = await destRes.json();
  console.log("[search] dest full:", JSON.stringify(destJson).slice(0, 500));
  const dest = destJson?.data?.[0] ?? destJson?.result?.[0];
  if (!dest) throw new Error(`Sin destino para "${q.ciudad}". Respuesta: ${JSON.stringify(destJson).slice(0, 200)}`);
  console.log("[search] dest picked:", dest.dest_id, dest.dest_type, dest.name);

  const url = new URL("https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels");
  url.searchParams.set("dest_id", String(dest.dest_id));
  url.searchParams.set("search_type", "CITY");
  url.searchParams.set("arrival_date", q.check_in);
  url.searchParams.set("departure_date", q.check_out);
  url.searchParams.set("adults", String(adults));
  url.searchParams.set("room_qty", "1");
  url.searchParams.set("page_number", "1");
  url.searchParams.set("currency_code", "EUR");
  url.searchParams.set("languagecode", "es");
  if (q.tipo === "apartamento") url.searchParams.set("categories_filter", "property_type::201");

  const res = await fetch(url, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": "booking-com15.p.rapidapi.com" },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("[search] hotels error", res.status, t);
    throw new Error(`Booking search ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const hotels = json?.data?.hotels ?? json?.result?.hotels ?? json?.result ?? [];
  console.log(`[search] hotels found: ${hotels.length} | url: ${url.toString()}`);
  if (hotels.length === 0) {
    console.log("[search] empty response sample:", JSON.stringify(json).slice(0, 800));
    const m = json?.message;
    if (m) {
      let msg: string;
      if (Array.isArray(m)) msg = m.map((x) => (typeof x === "string" ? x : (x?.message ?? JSON.stringify(x)))).join("; ");
      else if (typeof m === "object") msg = m?.message ?? JSON.stringify(m);
      else msg = String(m);
      throw new Error(`Booking: ${msg}`);
    }
  }

  const nights = Math.max(
    1,
    Math.round((new Date(q.check_out).getTime() - new Date(q.check_in).getTime()) / (1000 * 60 * 60 * 24)),
  );

  const items = hotels.slice(0, 12).map((h: any) => {
    const p = h?.property ?? {};
    const total = p?.priceBreakdown?.grossPrice?.value ?? null;
    const perNight = total ? +(total / nights).toFixed(2) : null;
    const hotelId = p?.id ?? h?.hotel_id;
    return {
      provider: "booking",
      id: String(hotelId ?? crypto.randomUUID()),
      name: p?.name ?? h?.hotel_name ?? "Sin nombre",
      price_per_night: perNight,
      price_total: total ? +total.toFixed(2) : null,
      currency: p?.priceBreakdown?.grossPrice?.currency ?? "EUR",
      rating: p?.reviewScore ?? h?.review_score ?? null,
      reviews: p?.reviewCount ?? h?.review_nr ?? null,
      address: h?.address ?? p?.wishlistName ?? q.ciudad,
      checkin: q.check_in,
      checkout: q.check_out,
      cancelacion_gratis: !!p?.isFreeCancellable,
      photos: Array.isArray(p?.photoUrls) ? p.photoUrls : (h?.main_photo_url ? [h.main_photo_url] : []),
      url: hotelId ? `https://www.booking.com/hotel/-/-/${hotelId}.html` : null,
      tipo: q.tipo ?? "hotel",
    };
  });

  return q.max_precio
    ? items.filter((i: any) => !i.price_per_night || i.price_per_night <= q.max_precio!)
    : items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RAPIDAPI_KEY");
    console.log("[search] RAPIDAPI_KEY present:", !!key);
    if (!key) {
      return new Response(JSON.stringify({ error: "RAPIDAPI_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const input = (await req.json()) as SearchInput;
    if (!input?.ciudad || !input?.check_in || !input?.check_out) {
      return new Response(JSON.stringify({ error: "Faltan parámetros: ciudad, check_in, check_out" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const results = await searchBooking(key, input);
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});