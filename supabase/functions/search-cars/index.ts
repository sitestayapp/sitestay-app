import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOST = "booking-com15.p.rapidapi.com";

type In = {
  ciudad: string;
  pick_up_date: string;   // YYYY-MM-DD
  drop_off_date: string;  // YYYY-MM-DD
  pick_up_time?: string;  // HH:MM
  drop_off_time?: string; // HH:MM
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RAPIDAPI_KEY");
    if (!key) return new Response(JSON.stringify({ error: "RAPIDAPI_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const input = (await req.json()) as In;
    if (!input?.ciudad || !input?.pick_up_date || !input?.drop_off_date) {
      return new Response(JSON.stringify({ error: "Faltan parámetros: ciudad, pick_up_date, drop_off_date" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const headers = { "x-rapidapi-key": key, "x-rapidapi-host": HOST };

    // 1) Destination
    const destUrl = new URL(`https://${HOST}/api/v1/cars/searchDestination`);
    destUrl.searchParams.set("query", input.ciudad);
    const destRes = await fetch(destUrl, { headers });
    if (!destRes.ok) throw new Error(`Cars dest ${destRes.status}: ${(await destRes.text()).slice(0, 200)}`);
    const destJson = await destRes.json();
    console.log("[cars] dest sample:", JSON.stringify(destJson).slice(0, 400));
    const dest = destJson?.data?.[0];
    const lat = dest?.coordinates?.latitude ?? dest?.latitude ?? dest?.pick_up_latitude;
    const lng = dest?.coordinates?.longitude ?? dest?.longitude ?? dest?.pick_up_longitude;
    if (lat == null || lng == null) throw new Error(`Sin coordenadas para "${input.ciudad}"`);

    // 2) Search car rentals (same pickup & dropoff location)
    const url = new URL(`https://${HOST}/api/v1/cars/searchCarRentals`);
    url.searchParams.set("pick_up_latitude", String(lat));
    url.searchParams.set("pick_up_longitude", String(lng));
    url.searchParams.set("drop_off_latitude", String(lat));
    url.searchParams.set("drop_off_longitude", String(lng));
    url.searchParams.set("pick_up_date", input.pick_up_date);
    url.searchParams.set("drop_off_date", input.drop_off_date);
    url.searchParams.set("pick_up_time", input.pick_up_time ?? "10:00");
    url.searchParams.set("drop_off_time", input.drop_off_time ?? "10:00");
    url.searchParams.set("driver_age", "30");
    url.searchParams.set("currency_code", "EUR");
    url.searchParams.set("location", "Default");

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Cars search ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const list = json?.data?.search_results ?? json?.data?.searchResults ?? json?.searchResults ?? [];
    console.log(`[cars] found: ${Array.isArray(list) ? list.length : 0}`);

    const nights = Math.max(1, Math.round((new Date(input.drop_off_date).getTime() - new Date(input.pick_up_date).getTime()) / 86400000));

    const items = (Array.isArray(list) ? list : []).slice(0, 6).map((r: any) => {
      const v = r?.vehicle_info ?? r?.vehicleInfo ?? {};
      const sup = r?.supplier_info ?? r?.supplierInfo ?? {};
      const price = r?.pricing_info?.price ?? r?.pricingInfo?.price ?? r?.price?.amount ?? null;
      const total = price != null ? Number(price) : null;
      const perDay = total ? +(total / nights).toFixed(2) : null;
      return {
        id: String(r?.vehicle_id ?? r?.id ?? crypto.randomUUID()),
        model: v?.v_name ?? v?.name ?? "Vehículo",
        group: v?.group ?? v?.category ?? null,
        company: sup?.name ?? r?.supplier_name ?? null,
        company_logo: sup?.logo_url ?? null,
        photo: v?.image_url ?? v?.imageUrl ?? v?.image_thumbnail_url ?? null,
        seats: v?.seats ?? null,
        transmission: v?.transmission ?? null,
        bags: v?.suitcases?.big ?? v?.bags ?? null,
        rating: r?.rating_info?.average ?? r?.ratingInfo?.average ?? null,
        price_per_day: perDay,
        price_total: total,
        currency: "EUR",
        pick_up_date: input.pick_up_date,
        drop_off_date: input.drop_off_date,
        location: dest?.name ?? input.ciudad,
        url: r?.forward_url ?? r?.forwardUrl ?? null,
      };
    });

    return new Response(JSON.stringify({ results: items }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cars error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});