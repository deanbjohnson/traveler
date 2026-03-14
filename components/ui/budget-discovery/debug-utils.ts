const DEBUG = process.env.NODE_ENV === "development";

export const debugOfferStructure = (offer: unknown, label: string) => {
  if (!DEBUG) return;
  console.log(`🔍 ${label} - Full offer structure:`, offer);
  const o = offer as { slices?: unknown[] };
  console.log(`🔍 ${label} - Slices:`, o?.slices);
  console.log(`🔍 ${label} - First slice:`, o?.slices?.[0]);
  const slice = o?.slices?.[0] as { departing_at?: unknown; arriving_at?: unknown; departure_datetime?: unknown; arrival_datetime?: unknown; segments?: unknown[] };
  console.log(`🔍 ${label} - First slice departing_at:`, slice?.departing_at);
  console.log(`🔍 ${label} - First slice arriving_at:`, slice?.arriving_at);
  console.log(`🔍 ${label} - First slice departure_datetime:`, slice?.departure_datetime);
  console.log(`🔍 ${label} - First slice arrival_datetime:`, slice?.arrival_datetime);
  console.log(`🔍 ${label} - First slice segments:`, slice?.segments);
  const seg = slice?.segments?.[0] as { departing_at?: unknown; arriving_at?: unknown };
  console.log(`🔍 ${label} - First segment:`, slice?.segments?.[0]);
  console.log(`🔍 ${label} - First segment departing_at:`, seg?.departing_at);
  console.log(`🔍 ${label} - First segment arriving_at:`, seg?.arriving_at);
};

export const debugLegData = (legData: unknown, label: string) => {
  if (!DEBUG) return;
  const leg = legData as Record<string, unknown>;
  console.log(`🔍 ${label} - Leg data structure:`, legData);
  console.log(`🔍 ${label} - Departure field:`, leg?.departure);
  console.log(`🔍 ${label} - Arrival field:`, leg?.arrival);
  console.log(`🔍 ${label} - Route field:`, leg?.route);
  console.log(`🔍 ${label} - Duration field:`, leg?.duration);
  console.log(`🔍 ${label} - Price field:`, leg?.price);
};

export const debugServerActionResponse = (response: unknown, label: string) => {
  if (!DEBUG) return;
  const r = response as { success?: unknown; data?: { offers?: unknown[] } };
  console.log(`🔍 ${label} - Server action response:`, response);
  console.log(`🔍 ${label} - Success:`, r?.success);
  console.log(`🔍 ${label} - Data:`, r?.data);
  console.log(`🔍 ${label} - Offers:`, r?.data?.offers);
  console.log(`🔍 ${label} - First offer:`, r?.data?.offers?.[0]);
  if (r?.data?.offers?.[0]) {
    debugOfferStructure(r.data.offers[0], `${label} - First Offer`);
  }
};
