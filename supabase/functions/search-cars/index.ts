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

function toYMD(s: string): string {
  if (!s) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}
function toHM(s?: string, fallback = "10:00"): string {
  if (!s) return fallback;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RAPIDAPI_KEY");
    if (!key) return new Response(JSON.stringify({ error: "RAPIDAPI_KEY no configurada" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const input = (await req.json()) as In;
    if (!input?.ciudad || !input?.pick_up_date || !input?.drop_off_date) {
      return new Response(JSON.stringify({ error: "Faltan parámetros: ciudad, pick_up_date, drop_off_date" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const pick_up_date = toYMD(input.pick_up_date);
    const drop_off_date = toYMD(input.drop_off_date);
    const pick_up_time = toHM(input.pick_up_time, "10:00");
    const drop_off_time = toHM(input.drop_off_time, "10:00");
    const headers = { "x-rapidapi-key": key, "x-rapidapi-host": HOST };

    // 1) Destination
    const destUrl = new URL(`https://${HOST}/api/v1/cars/searchDestination`);
    destUrl.searchParams.set("query", input.ciudad);
    const destRes = await fetch(destUrl, { headers });
    if (!destRes.ok) throw new Error(`Cars dest ${destRes.status}: ${(await destRes.text()).slice(0, 200)}`);
    const destJson = await destRes.json();
    console.log("[cars] dest FULL response:", JSON.stringify(destJson).slice(0, 2000));
    const destList: any[] = Array.isArray(destJson?.data) ? destJson.data : Array.isArray(destJson) ? destJson : [];
    // Find first result with usable coordinates
    let dest: any = null;
    let lat: any = null;
    let lng: any = null;
    for (const candidate of destList) {
      const cLat = candidate?.coordinates?.latitude ?? candidate?.latitude ?? candidate?.lat ?? candidate?.pick_up_latitude;
      const cLng = candidate?.coordinates?.longitude ?? candidate?.longitude ?? candidate?.lng ?? candidate?.lon ?? candidate?.pick_up_longitude;
      if (cLat != null && cLng != null) {
        dest = candidate; lat = cLat; lng = cLng; break;
      }
    }
    if (lat == null || lng == null) {
      console.error("[cars] no coords. keys of first item:", destList[0] ? Object.keys(destList[0]) : "n/a");
      throw new Error(`Sin coordenadas para "${input.ciudad}". Respuesta: ${JSON.stringify(destJson).slice(0, 300)}`);
    }
    console.log(`[cars] using dest: ${dest?.name ?? dest?.city ?? input.ciudad} lat=${lat} lng=${lng}`);

    // 2) Search car rentals (same pickup & dropoff location). Try with EUR; fallback without currency.
    const buildUrl = (withCurrency: boolean) => {
      const url = new URL(`https://${HOST}/api/v1/cars/searchCarRentals`);
      url.searchParams.set("pick_up_latitude", String(lat));
      url.searchParams.set("pick_up_longitude", String(lng));
      url.searchParams.set("drop_off_latitude", String(lat));
      url.searchParams.set("drop_off_longitude", String(lng));
      url.searchParams.set("pick_up_date", pick_up_date);
      url.searchParams.set("drop_off_date", drop_off_date);
      url.searchParams.set("pick_up_time", pick_up_time);
      url.searchParams.set("drop_off_time", drop_off_time);
      url.searchParams.set("driver_age", "30");
      if (withCurrency) url.searchParams.set("currency_code", "EUR");
      url.searchParams.set("location", "Default");
      return url;
    };

    let res = await fetch(buildUrl(true), { headers });
    let json: any = null;
    if (!res.ok) {
      const errTxt = (await res.text()).slice(0, 300);
      console.warn(`[cars] EUR attempt failed ${res.status}: ${errTxt} — retrying without currency`);
      res = await fetch(buildUrl(false), { headers });
      if (!res.ok) throw new Error(`Cars search ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    json = await res.json();
    console.log("[cars] search FULL response:", JSON.stringify(json).slice(0, 2000));
    const list =
      json?.data?.search_results ??
      json?.data?.searchResults ??
      json?.data?.results ??
      json?.data?.result ??
      json?.searchResults ??
      json?.search_results ??
      json?.results ??
      (Array.isArray(json?.data) ? json.data : null) ??
      [];
    console.log(`[cars] found: ${Array.isArray(list) ? list.length : 0}`);
    if (!Array.isArray(list) || list.length === 0) {
      const apiMsg = json?.message ?? json?.error ?? json?.data?.message ?? "respuesta vacía";
      return new Response(JSON.stringify({ results: [], error: `Sin coches disponibles. API: ${typeof apiMsg === "string" ? apiMsg : JSON.stringify(apiMsg)}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const nights = Math.max(1, Math.round((new Date(drop_off_date).getTime() - new Date(pick_up_date).getTime()) / 86400000));

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
        pick_up_date,
        drop_off_date,
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