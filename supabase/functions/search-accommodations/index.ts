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
  habitaciones?: number;
  tipo?: "hotel" | "apartamento";
  max_precio?: number;
};

const HOSTEL_KEYWORDS = /hostel|albergue|backpacker|dormitor[yi]|dorm\b|youth hostel/i;

function excludeHostels(items: any[]): any[] {
  return items.filter((i) => !HOSTEL_KEYWORDS.test(i.name ?? ""));
}

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
  url.searchParams.set("room_qty", String(q.habitaciones ?? 1));
  url.searchParams.set("page_number", "1");
  url.searchParams.set("currency_code", "EUR");
  url.searchParams.set("languagecode", "es");
  if (q.tipo === "apartamento") {
    // 201=Apartments, exclude 203=Hostels
    url.searchParams.set("categories_filter_ids", "property_type::201");
  } else {
    // For general/hotel: exclude hostels and private rooms in shared spaces
    url.searchParams.set("categories_filter_ids", "property_type::204,property_type::208,property_type::213,property_type::201");
  }

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

  // country code from destination (cc1 = "es", "fr", etc.)
  const cc = (dest?.cc1 ?? dest?.country_code ?? "es").toLowerCase().slice(0, 2);

  const toSlug = (name: string) =>
    name.toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const items = hotels.slice(0, 12).map((h: any) => {
    const p = h?.property ?? {};
    const total = p?.priceBreakdown?.grossPrice?.value ?? null;
    const perNight = total ? +(total / nights).toFixed(2) : null;
    const hotelId = p?.id ?? h?.hotel_id;
    const hotelName = p?.name ?? h?.hotel_name ?? "";
    // wishlistName is Booking's own URL slug when present
    const slug = p?.wishlistName ?? toSlug(hotelName);
    const hotelUrl = slug
      ? `https://www.booking.com/hotel/${cc}/${slug}.html?checkin=${q.check_in}&checkout=${q.check_out}&group_adults=${adults}`
      : `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}&checkin=${q.check_in}&checkout=${q.check_out}&group_adults=${adults}`;
    return {
      provider: "booking",
      id: String(hotelId ?? crypto.randomUUID()),
      name: hotelName || "Sin nombre",
      price_per_night: perNight,
      price_total: total ? +total.toFixed(2) : null,
      currency: p?.priceBreakdown?.grossPrice?.currency ?? "EUR",
      rating: p?.reviewScore ?? h?.review_score ?? null,
      reviews: p?.reviewCount ?? h?.review_nr ?? null,
      address: h?.address ?? q.ciudad,
      checkin: q.check_in,
      checkout: q.check_out,
      cancelacion_gratis: !!p?.isFreeCancellable,
      photos: Array.isArray(p?.photoUrls) ? p.photoUrls : (h?.main_photo_url ? [h.main_photo_url] : []),
      url: hotelUrl,
      tipo: q.tipo ?? "hotel",
    };
  });

  // Only return results with a confirmed price (= available for these dates)
  const available = items.filter((i: any) => i.price_per_night !== null && i.price_per_night > 0);
  const filtered = excludeHostels(available);
  return q.max_precio
    ? filtered.filter((i: any) => i.price_per_night <= q.max_precio!)
    : filtered;
}

async function searchAirbnb(key: string, q: SearchInput) {
  const adults = q.adultos ?? 1;
  console.log("[airbnb] input:", JSON.stringify(q));
  const locUrl = new URL("https://airbnb19.p.rapidapi.com/api/v2/searchLocation");
  locUrl.searchParams.set("query", q.ciudad);
  const locRes = await fetch(locUrl, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": "airbnb19.p.rapidapi.com" },
  });
  if (!locRes.ok) throw new Error(`Airbnb loc ${locRes.status}: ${(await locRes.text()).slice(0, 200)}`);
  const locJson = await locRes.json();
  console.log("[airbnb] loc sample:", JSON.stringify(locJson).slice(0, 400));
  const first = locJson?.data?.[0] ?? locJson?.results?.[0] ?? locJson?.[0];
  const placeId = first?.placeId ?? first?.place_id ?? first?.id;
  if (!placeId) throw new Error(`Airbnb sin placeId para "${q.ciudad}"`);

  const url = new URL("https://airbnb19.p.rapidapi.com/api/v2/searchPropertyByPlace");
  url.searchParams.set("placeId", String(placeId));
  url.searchParams.set("adults", String(adults));
  url.searchParams.set("checkin", q.check_in);
  url.searchParams.set("checkout", q.check_out);
  url.searchParams.set("currency", "EUR");

  const res = await fetch(url, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": "airbnb19.p.rapidapi.com" },
  });
  if (!res.ok) throw new Error(`Airbnb search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const list = json?.data?.list ?? json?.data ?? json?.results ?? [];
  console.log(`[airbnb] found: ${Array.isArray(list) ? list.length : 0}`);

  const nights = Math.max(1, Math.round((new Date(q.check_out).getTime() - new Date(q.check_in).getTime()) / 86400000));

  const items = (Array.isArray(list) ? list : []).slice(0, 12).map((p: any) => {
    const listing = p?.listing ?? p;
    const pricing = p?.pricingQuote ?? p?.pricing ?? {};
    const totalRaw = pricing?.structuredStayDisplayPrice?.primaryLine?.price
      ?? pricing?.price?.total?.amount
      ?? pricing?.rate?.amount
      ?? null;
    const total = typeof totalRaw === "string" ? Number(totalRaw.replace(/[^0-9.]/g, "")) : totalRaw;
    const perNight = total ? +(total / nights).toFixed(2) : null;
    const id = listing?.id ?? p?.id;
    const photos: string[] = (listing?.contextualPictures ?? listing?.pictures ?? [])
      .map((x: any) => x?.picture ?? x?.url ?? x).filter(Boolean);
    return {
      provider: "airbnb",
      id: String(id ?? crypto.randomUUID()),
      name: listing?.name ?? listing?.title ?? "Airbnb",
      price_per_night: perNight,
      price_total: total ? +Number(total).toFixed(2) : null,
      currency: "EUR",
      rating: listing?.avgRating ? Number(listing.avgRating) * 2 : (listing?.starRating ?? null),
      reviews: listing?.reviewsCount ?? null,
      address: listing?.localizedCityName ?? listing?.city ?? q.ciudad,
      checkin: q.check_in,
      checkout: q.check_out,
      cancelacion_gratis: false,
      photos,
      url: id ? `https://www.airbnb.com/rooms/${id}` : null,
      tipo: q.tipo ?? "apartamento",
    };
  });

  return q.max_precio
    ? items.filter((i: any) => !i.price_per_night || i.price_per_night <= q.max_precio!)
    : items;
}

// ---------- FALLBACK 1: booking-com.p.rapidapi.com (Tipsters) ----------
async function searchBookingTipsters(key: string, q: SearchInput) {
  const adults = q.adultos ?? 1;
  console.log("[fallback1/booking-tipsters] input:", JSON.stringify(q));
  const HOST_T = "booking-com.p.rapidapi.com";
  // Resolve dest_id via locations endpoint
  const locUrl = new URL(`https://${HOST_T}/v1/hotels/locations`);
  locUrl.searchParams.set("name", q.ciudad);
  locUrl.searchParams.set("locale", "es");
  const locRes = await fetch(locUrl, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_T } });
  if (!locRes.ok) throw new Error(`Tipsters loc ${locRes.status}`);
  const locJson = await locRes.json();
  const loc = (Array.isArray(locJson) ? locJson : locJson?.data ?? [])[0];
  if (!loc) throw new Error(`Tipsters sin destino para "${q.ciudad}"`);
  const destId = loc?.dest_id ?? loc?.id;
  const destType = loc?.dest_type ?? "city";
  const ccT = (loc?.cc1 ?? loc?.country_code ?? "es").toLowerCase().slice(0, 2);

  const url = new URL(`https://${HOST_T}/v1/hotels/search`);
  url.searchParams.set("dest_id", String(destId));
  url.searchParams.set("dest_type", String(destType));
  url.searchParams.set("checkin_date", q.check_in);
  url.searchParams.set("checkout_date", q.check_out);
  url.searchParams.set("adults_number", String(adults));
  url.searchParams.set("room_number", String(q.habitaciones ?? 1));
  url.searchParams.set("order_by", "bayesian_review_score");
  url.searchParams.set("filter_by_currency", "EUR");
  url.searchParams.set("locale", "es");
  url.searchParams.set("units", "metric");
  url.searchParams.set("page_number", "0");
  // categories_filter_ids is a booking-com15 param — not supported on Tipsters v1
  const res = await fetch(url, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_T } });
  if (!res.ok) throw new Error(`Tipsters search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const hotels = json?.result ?? json?.results ?? json?.data ?? [];
  console.log(`[fallback1/booking-tipsters] found: ${hotels.length}`);
  const nights = Math.max(1, Math.round((new Date(q.check_out).getTime() - new Date(q.check_in).getTime()) / 86400000));
  const toSlugT = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const mapped = (Array.isArray(hotels) ? hotels : []).slice(0, 25).map((h: any) => {
    const total = h?.min_total_price ?? h?.price_breakdown?.gross_price ?? null;
    const perNight = total ? +(Number(total) / nights).toFixed(2) : null;
    const hotelName = h?.hotel_name ?? "";
    const slug = h?.url_name ?? toSlugT(hotelName);
    const hotelUrl = h?.url
      ?? (slug ? `https://www.booking.com/hotel/${ccT}/${slug}.html?checkin=${q.check_in}&checkout=${q.check_out}&group_adults=${adults}` : null)
      ?? `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}&checkin=${q.check_in}&checkout=${q.check_out}&group_adults=${adults}`;
    return {
      provider: "booking",
      id: String(h?.hotel_id ?? crypto.randomUUID()),
      name: hotelName || "Hotel",
      price_per_night: perNight,
      price_total: total ? +Number(total).toFixed(2) : null,
      currency: h?.currencycode ?? "EUR",
      rating: h?.review_score ?? null,
      reviews: h?.review_nr ?? null,
      address: h?.address ?? q.ciudad,
      checkin: q.check_in,
      checkout: q.check_out,
      cancelacion_gratis: !!h?.is_free_cancellable,
      photos: h?.main_photo_url ? [h.main_photo_url] : [],
      url: hotelUrl,
      tipo: q.tipo ?? "hotel",
    };
  });
  const availableT = mapped.filter((i: any) => i.price_per_night !== null && i.price_per_night > 0);
  return excludeHostels(availableT).slice(0, 12);
}

// ---------- FALLBACK 2: tripadvisor-com1 (Things4u) ----------
async function searchTripadvisor(key: string, q: SearchInput) {
  const adults = q.adultos ?? 1;
  console.log("[fallback2/tripadvisor] input:", JSON.stringify(q));
  const HOST_TA = "tripadvisor-com1.p.rapidapi.com";
  const locUrl = new URL(`https://${HOST_TA}/hotels/auto-complete`);
  locUrl.searchParams.set("query", q.ciudad);
  const locRes = await fetch(locUrl, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_TA } });
  if (!locRes.ok) throw new Error(`TA loc ${locRes.status}`);
  const locJson = await locRes.json();
  const list = locJson?.data ?? locJson?.results ?? [];
  const geoId = list?.[0]?.geoId ?? list?.[0]?.geo_id ?? list?.[0]?.id;
  if (!geoId) throw new Error(`TA sin geoId para "${q.ciudad}"`);
  const url = new URL(`https://${HOST_TA}/hotels/search`);
  url.searchParams.set("geoId", String(geoId));
  url.searchParams.set("checkIn", q.check_in);
  url.searchParams.set("checkOut", q.check_out);
  url.searchParams.set("adults", String(adults));
  url.searchParams.set("rooms", "1");
  url.searchParams.set("currencyCode", "EUR");
  const res = await fetch(url, { headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST_TA } });
  if (!res.ok) throw new Error(`TA search ${res.status}`);
  const json = await res.json();
  const hotels = json?.data?.data ?? json?.data ?? json?.results ?? [];
  console.log(`[fallback2/tripadvisor] found: ${Array.isArray(hotels) ? hotels.length : 0}`);
  const nights = Math.max(1, Math.round((new Date(q.check_out).getTime() - new Date(q.check_in).getTime()) / 86400000));
  return (Array.isArray(hotels) ? hotels : []).slice(0, 12).map((h: any) => {
    const priceRaw = h?.priceForDisplay ?? h?.price?.amount ?? h?.priceDetails ?? null;
    const total = typeof priceRaw === "string" ? Number(priceRaw.replace(/[^0-9.]/g, "")) : priceRaw;
    const perNight = total ? +(Number(total) / nights).toFixed(2) : null;
    const photos = (h?.cardPhotos ?? h?.photos ?? []).map((p: any) => p?.sizes?.urlTemplate?.replace("{width}", "800")?.replace("{height}", "600") ?? p?.url ?? p).filter(Boolean);
    return {
      provider: "tripadvisor",
      id: String(h?.id ?? crypto.randomUUID()),
      name: h?.title ?? h?.name ?? "Hotel",
      price_per_night: perNight,
      price_total: total ? +Number(total).toFixed(2) : null,
      currency: "EUR",
      rating: h?.bubbleRating?.rating ?? h?.rating ?? null,
      reviews: h?.bubbleRating?.count ?? h?.reviewCount ?? null,
      address: h?.secondaryInfo ?? q.ciudad,
      checkin: q.check_in,
      checkout: q.check_out,
      cancelacion_gratis: false,
      photos,
      url: h?.commerceInfo?.externalUrl ?? null,
      tipo: q.tipo ?? "hotel",
    };
  });
}

async function searchAccommodationWithFallback(key: string, input: SearchInput) {
  const providers: Array<[string, () => Promise<any[]>]> = [
    ["booking-com (Tipsters)", () => searchBookingTipsters(key, input)],
    ["booking-com15 (DataCrawler)", () => searchBooking(key, input)],
    ["airbnb19", () => searchAirbnb(key, input)],
  ];
  let lastErr: any = null;
  for (const [name, fn] of providers) {
    try {
      const res = await fn();
      if (Array.isArray(res) && res.length > 0) {
        console.log(`[accommodation] ✅ provider responded: ${name} (${res.length} results)`);
        return res;
      }
      console.warn(`[accommodation] ${name} returned 0 results, trying next`);
    } catch (e) {
      lastErr = e;
      console.warn(`[accommodation] ${name} failed:`, e instanceof Error ? e.message : e);
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RAPIDAPI_KEY");
    console.log("[search] RAPIDAPI_KEY present:", !!key, "| prefix:", key ? key.slice(0, 10) : "MISSING");
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
    let results: any[] = [];
    try {
      results = await searchAccommodationWithFallback(key, input);
    } catch (e) {
      console.error("[search] all providers failed:", e instanceof Error ? e.message : e);
    }

    if (results.length === 0) {
      const body = JSON.stringify({ results: [], error: "No hay alojamientos disponibles en este momento. Intenta con otras fechas o ciudad." });
      console.log("[search] FINAL RESPONSE (0 results):", body);
      return new Response(body, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    results.sort((a, b) => {
      const pa = a.price_per_night ?? Number.MAX_SAFE_INTEGER;
      const pb = b.price_per_night ?? Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });

    console.log("[search] FINAL RESPONSE: results count =", results.length, "| first:", JSON.stringify(results[0]).slice(0, 200));
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