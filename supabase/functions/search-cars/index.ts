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

const CITY_FALLBACK_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  "madrid": { lat: 40.4168, lng: -3.7038, name: "Madrid" },
  "barcelona": { lat: 41.3851, lng: 2.1734, name: "Barcelona" },
  "berlin": { lat: 52.5200, lng: 13.4050, name: "Berlin" },
  "berlín": { lat: 52.5200, lng: 13.4050, name: "Berlin" },
  "paris": { lat: 48.8566, lng: 2.3522, name: "Paris" },
  "parís": { lat: 48.8566, lng: 2.3522, name: "Paris" },
  "munich": { lat: 48.1351, lng: 11.5820, name: "Munich" },
  "múnich": { lat: 48.1351, lng: 11.5820, name: "Munich" },
  "amsterdam": { lat: 52.3676, lng: 4.9041, name: "Amsterdam" },
  "ámsterdam": { lat: 52.3676, lng: 4.9041, name: "Amsterdam" },
  "london": { lat: 51.5074, lng: -0.1278, name: "London" },
  "londres": { lat: 51.5074, lng: -0.1278, name: "London" },
  "rome": { lat: 41.9028, lng: 12.4964, name: "Rome" },
  "roma": { lat: 41.9028, lng: 12.4964, name: "Rome" },
  "lisbon": { lat: 38.7223, lng: -9.1393, name: "Lisbon" },
  "lisboa": { lat: 38.7223, lng: -9.1393, name: "Lisbon" },
  "brussels": { lat: 50.8503, lng: 4.3517, name: "Brussels" },
  "bruselas": { lat: 50.8503, lng: 4.3517, name: "Brussels" },
  "frankfurt": { lat: 50.1109, lng: 8.6821, name: "Frankfurt" },
  "hamburg": { lat: 53.5753, lng: 10.0153, name: "Hamburg" },
  "hamburgo": { lat: 53.5753, lng: 10.0153, name: "Hamburg" },
  "vienna": { lat: 48.2082, lng: 16.3738, name: "Vienna" },
  "viena": { lat: 48.2082, lng: 16.3738, name: "Vienna" },
  "warsaw": { lat: 52.2297, lng: 21.0122, name: "Warsaw" },
  "varsovia": { lat: 52.2297, lng: 21.0122, name: "Warsaw" },
  "prague": { lat: 50.0755, lng: 14.4378, name: "Prague" },
  "praga": { lat: 50.0755, lng: 14.4378, name: "Prague" },
};

const CITY_IATA: Record<string, string> = {
  "madrid": "MAD", "barcelona": "BCN", "berlin": "BER", "berlín": "BER",
  "paris": "CDG", "parís": "CDG", "munich": "MUC", "múnich": "MUC",
  "amsterdam": "AMS", "ámsterdam": "AMS", "london": "LHR", "londres": "LHR",
  "rome": "FCO", "roma": "FCO", "lisbon": "LIS", "lisboa": "LIS",
  "brussels": "BRU", "bruselas": "BRU", "frankfurt": "FRA",
  "hamburg": "HAM", "hamburgo": "HAM", "vienna": "VIE", "viena": "VIE",
  "warsaw": "WAW", "varsovia": "WAW", "prague": "PRG", "praga": "PRG",
};

function extractCoords(destJson: any): { lat: number; lng: number; dest: any } | null {
  const list: any[] = Array.isArray(destJson?.data) ? destJson.data : Array.isArray(destJson) ? destJson : [];
  for (const c of list) {
    const lat = c?.coordinates?.latitude ?? c?.latitude ?? c?.lat ?? c?.pick_up_latitude;
    const lng = c?.coordinates?.longitude ?? c?.longitude ?? c?.lng ?? c?.lon ?? c?.pick_up_longitude;
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng), dest: c };
  }
  return null;
}

async function resolveCoords(ciudad: string, headers: Record<string, string>): Promise<{ lat: number; lng: number; name: string }> {
  const lower = ciudad.trim().toLowerCase();
  const queries = [ciudad, `${ciudad}, Spain`, `${ciudad} ES`, CITY_IATA[lower]].filter(Boolean) as string[];

  for (const q of queries) {
    try {
      const u = new URL(`https://${HOST}/api/v1/cars/searchDestination`);
      u.searchParams.set("query", q);
      const r = await fetch(u, { headers });
      if (!r.ok) { console.warn(`[cars] dest "${q}" status ${r.status}`); continue; }
      const j = await r.json();
      console.log(`[cars] dest "${q}" response:`, JSON.stringify(j).slice(0, 800));
      const coords = extractCoords(j);
      if (coords) {
        return { lat: coords.lat, lng: coords.lng, name: coords.dest?.name ?? coords.dest?.city ?? ciudad };
      }
    } catch (e) {
      console.warn(`[cars] dest "${q}" error`, e);
    }
  }

  // Hardcoded fallback
  const hc = CITY_FALLBACK_COORDS[lower];
  if (hc) {
    console.log(`[cars] using HARDCODED coords for ${ciudad}`);
    return { lat: hc.lat, lng: hc.lng, name: hc.name };
  }

  // Nominatim geocoding fallback
  try {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("q", ciudad);
    u.searchParams.set("format", "json");
    u.searchParams.set("limit", "1");
    const r = await fetch(u, { headers: { "User-Agent": "SiteStayApp/1.0 (reservas@sitestayapp.com)" } });
    if (r.ok) {
      const j = await r.json();
      console.log(`[cars] nominatim "${ciudad}":`, JSON.stringify(j).slice(0, 400));
      if (Array.isArray(j) && j[0]?.lat && j[0]?.lon) {
        return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), name: j[0].display_name?.split(",")[0] ?? ciudad };
      }
    }
  } catch (e) {
    console.warn("[cars] nominatim error", e);
  }

  throw new Error(`No se pudieron obtener coordenadas para "${ciudad}" (Booking, hardcoded ni Nominatim).`);
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

    // 1) Resolve coords (query variants → hardcoded → Nominatim)
    const { lat, lng, name: destName } = await resolveCoords(input.ciudad, headers);
    const dest = { name: destName };
    console.log(`[cars] resolved coords for ${input.ciudad}: lat=${lat} lng=${lng} (${destName})`);

    const nights = Math.max(1, Math.round((new Date(drop_off_date).getTime() - new Date(pick_up_date).getTime()) / 86400000));

    // ---------- PROVIDER 0: booking-com (Tipsters) ----------
    const tryTipstersCars = async (): Promise<any[]> => {
      const HOST_T = "booking-com.p.rapidapi.com";
      const url = new URL(`https://${HOST_T}/v1/cars/search`);
      url.searchParams.set("pick_up_latitude", String(lat));
      url.searchParams.set("pick_up_longitude", String(lng));
      url.searchParams.set("drop_off_latitude", String(lat));
      url.searchParams.set("drop_off_longitude", String(lng));
      url.searchParams.set("pick_up_date", pick_up_date);
      url.searchParams.set("drop_off_date", drop_off_date);
      url.searchParams.set("pick_up_time", pick_up_time);
      url.searchParams.set("drop_off_time", drop_off_time);
      url.searchParams.set("currency", "EUR");
      url.searchParams.set("locale", "es");
      const res = await fetch(url, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_T } });
      if (!res.ok) throw new Error(`tipsters cars ${res.status}`);
      const json = await res.json();
      const list = json?.result ?? json?.results ?? json?.data ?? (Array.isArray(json) ? json : []);
      if (!Array.isArray(list) || list.length === 0) throw new Error("tipsters cars: vacío");
      return list.slice(0, 6).map((r: any) => {
        const total = Number(r?.price?.total ?? r?.min_total_price ?? r?.price ?? 0) || null;
        return {
          id: String(r?.vehicle_id ?? r?.id ?? crypto.randomUUID()),
          model: r?.vehicle?.name ?? r?.v_name ?? r?.name ?? "Vehículo",
          group: r?.vehicle?.category ?? r?.group ?? null,
          company: r?.supplier?.name ?? r?.company_name ?? null,
          company_logo: r?.supplier?.logo ?? null,
          photo: r?.vehicle?.image ?? r?.image_url ?? null,
          seats: r?.vehicle?.seats ?? r?.seats ?? null,
          transmission: r?.vehicle?.transmission ?? r?.transmission ?? null,
          bags: r?.vehicle?.bags ?? r?.bags ?? null,
          rating: r?.rating ?? null,
          price_per_day: total ? +(total / nights).toFixed(2) : null,
          price_total: total,
          currency: "EUR",
          pick_up_date, drop_off_date,
          location: destName ?? input.ciudad,
          url: r?.url ?? null,
        };
      });
    };

    // ---------- PRIMARY: booking-com15 cars ----------
    const tryBookingCars = async (): Promise<any[]> => {
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
      if (!res.ok) {
        console.warn(`[cars/primary] EUR ${res.status}, retrying no currency`);
        res = await fetch(buildUrl(false), { headers });
        if (!res.ok) throw new Error(`booking-com15 cars ${res.status}`);
      }
      const json = await res.json();
      const list =
        json?.data?.search_results ?? json?.data?.searchResults ?? json?.data?.results ??
        json?.data?.result ?? json?.searchResults ?? json?.search_results ?? json?.results ??
        (Array.isArray(json?.data) ? json.data : null) ?? [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("booking-com15 cars: respuesta vacía");
      return list.slice(0, 6).map((r: any) => {
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
          location: destName ?? input.ciudad,
        url: r?.forward_url ?? r?.forwardUrl ?? null,
      };
    });
    };

    // ---------- FALLBACK 1: priceline-com2 ----------
    const tryPriceline = async (): Promise<any[]> => {
      const HOST_P = "priceline-com2.p.rapidapi.com";
      // Try new endpoint first, fall back to legacy
      const endpoints = [
        `/api/car-rentals/v1/search`,
        `/cars/search`,
      ];
      let j: any = null;
      for (const ep of endpoints) {
        const u = new URL(`https://${HOST_P}${ep}`);
        u.searchParams.set("pickup_latitude", String(lat));
        u.searchParams.set("pickup_longitude", String(lng));
        u.searchParams.set("dropoff_latitude", String(lat));
        u.searchParams.set("dropoff_longitude", String(lng));
        u.searchParams.set("pickup_date", pick_up_date);
        u.searchParams.set("dropoff_date", drop_off_date);
        u.searchParams.set("pickup_time", pick_up_time);
        u.searchParams.set("dropoff_time", drop_off_time);
        u.searchParams.set("currency", "EUR");
        const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_P } });
        console.log(`[cars] priceline ${ep} status:`, r.status);
        if (!r.ok) { console.warn(`[cars] priceline ${ep} failed ${r.status}`); continue; }
        j = await r.json();
        console.log(`[cars] priceline ${ep} sample:`, JSON.stringify(j).slice(0, 400));
        break;
      }
      if (!j) throw new Error("priceline cars: todos los endpoints fallaron");
      const list = j?.data?.results ?? j?.data?.cars ?? j?.results ?? j?.cars ??
        j?.data?.vehicleResults ?? j?.vehicleResults ?? (Array.isArray(j?.data) ? j.data : []);
      if (!Array.isArray(list) || list.length === 0) {
        const errDetail = j?.errors?.[0]?.message ?? j?.message ?? JSON.stringify(j).slice(0, 200);
        throw new Error(`priceline cars vacío. data keys: ${Object.keys(j?.data ?? {}).join(",") || "none"}. msg: ${errDetail}`);
      }
      return list.slice(0, 6).map((r: any) => {
        const total = Number(r?.totalPrice ?? r?.price?.total ?? r?.price?.amount ?? r?.price ?? 0) || null;
        return {
          id: String(r?.id ?? crypto.randomUUID()),
          model: r?.carName ?? r?.name ?? r?.vehicle?.name ?? r?.vehicleName ?? "Vehículo",
          group: r?.carClass ?? r?.category ?? r?.vehicleClass ?? null,
          company: r?.partnerName ?? r?.vendorName ?? r?.supplier?.name ?? null,
          company_logo: r?.partnerLogo ?? r?.vendorLogo ?? r?.supplier?.logo ?? null,
          photo: r?.imageUrl ?? r?.image ?? r?.vehicle?.image ?? null,
          seats: r?.passengers ?? r?.seats ?? r?.vehicle?.seats ?? null,
          transmission: r?.transmission ?? r?.vehicle?.transmission ?? null,
          bags: r?.bags ?? null,
          rating: r?.rating ?? null,
          price_per_day: total ? +(total / nights).toFixed(2) : null,
          price_total: total,
          currency: "EUR",
          pick_up_date, drop_off_date,
          location: destName ?? input.ciudad,
          url: r?.deepLink ?? r?.url ?? null,
        };
      });
    };

    // ---------- FALLBACK 2: expedia13 ----------
    const tryExpedia = async (): Promise<any[]> => {
      const HOST_E = "expedia13.p.rapidapi.com";
      const u = new URL(`https://${HOST_E}/api/v1/car/searchCars`);
      u.searchParams.set("pickUpLat", String(lat));
      u.searchParams.set("pickUpLng", String(lng));
      u.searchParams.set("dropOffLat", String(lat));
      u.searchParams.set("dropOffLng", String(lng));
      u.searchParams.set("pickUpDate", pick_up_date);
      u.searchParams.set("dropOffDate", drop_off_date);
      u.searchParams.set("pickUpTime", pick_up_time);
      u.searchParams.set("dropOffTime", drop_off_time);
      u.searchParams.set("currency", "EUR");
      const r = await fetch(u, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_E } });
      if (!r.ok) throw new Error(`expedia cars ${r.status}`);
      const j = await r.json();
      const list = j?.data?.offers ?? j?.data?.results ?? j?.results ?? j?.offers ?? [];
      if (!Array.isArray(list) || list.length === 0) throw new Error("expedia cars vacío");
      return list.slice(0, 6).map((r: any) => {
        const total = Number(r?.price?.total ?? r?.totalPrice ?? r?.price ?? 0) || null;
        return {
          id: String(r?.id ?? crypto.randomUUID()),
          model: r?.vehicle?.name ?? r?.carName ?? "Vehículo",
          group: r?.vehicle?.category ?? null,
          company: r?.vendor?.name ?? r?.partnerName ?? null,
          company_logo: r?.vendor?.logo ?? null,
          photo: r?.vehicle?.image ?? r?.imageUrl ?? null,
          seats: r?.vehicle?.seats ?? null,
          transmission: r?.vehicle?.transmission ?? null,
          bags: r?.vehicle?.bags ?? null,
          rating: r?.rating ?? null,
          price_per_day: total ? +(total / nights).toFixed(2) : null,
          price_total: total,
          currency: "EUR",
          pick_up_date, drop_off_date,
          location: destName ?? input.ciudad,
          url: r?.deepLink ?? r?.url ?? null,
        };
      });
    };

    const providers: Array<[string, () => Promise<any[]>]> = [
      ["booking-com (Tipsters)", tryTipstersCars],
      ["booking-com15", tryBookingCars],
      ["priceline-com2", tryPriceline],
      ["expedia13", tryExpedia],
    ];
    let items: any[] = [];
    const errs: string[] = [];
    for (const [name, fn] of providers) {
      try {
        items = await fn();
        if (items.length > 0) {
          console.log(`[cars] ✅ provider responded: ${name} (${items.length} results)`);
          break;
        }
        errs.push(`${name}: vacío`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errs.push(`${name}: ${msg}`);
        console.warn(`[cars] ${name} failed:`, msg);
      }
    }
    if (items.length === 0) {
      return new Response(JSON.stringify({ results: [], error: errs.join(" | ") }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ results: items }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cars error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});