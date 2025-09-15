// Debug utilities for tracing data flow issues

export const debugOfferStructure = (offer: any, label: string) => {
  console.log(`🔍 ${label} - Full offer structure:`, offer);
  console.log(`🔍 ${label} - Slices:`, offer?.slices);
  console.log(`🔍 ${label} - First slice:`, offer?.slices?.[0]);
  console.log(`🔍 ${label} - First slice departing_at:`, offer?.slices?.[0]?.departing_at);
  console.log(`🔍 ${label} - First slice arriving_at:`, offer?.slices?.[0]?.arriving_at);
  console.log(`🔍 ${label} - First slice departure_datetime:`, offer?.slices?.[0]?.departure_datetime);
  console.log(`🔍 ${label} - First slice arrival_datetime:`, offer?.slices?.[0]?.arrival_datetime);
  console.log(`🔍 ${label} - First slice segments:`, offer?.slices?.[0]?.segments);
  console.log(`🔍 ${label} - First segment:`, offer?.slices?.[0]?.segments?.[0]);
  console.log(`🔍 ${label} - First segment departing_at:`, offer?.slices?.[0]?.segments?.[0]?.departing_at);
  console.log(`🔍 ${label} - First segment arriving_at:`, offer?.slices?.[0]?.segments?.[0]?.arriving_at);
};

export const debugLegData = (legData: any, label: string) => {
  console.log(`🔍 ${label} - Leg data structure:`, legData);
  console.log(`🔍 ${label} - Departure field:`, legData?.departure);
  console.log(`🔍 ${label} - Arrival field:`, legData?.arrival);
  console.log(`🔍 ${label} - Route field:`, legData?.route);
  console.log(`🔍 ${label} - Duration field:`, legData?.duration);
  console.log(`🔍 ${label} - Price field:`, legData?.price);
};

export const debugServerActionResponse = (response: any, label: string) => {
  console.log(`🔍 ${label} - Server action response:`, response);
  console.log(`🔍 ${label} - Success:`, response?.success);
  console.log(`🔍 ${label} - Data:`, response?.data);
  console.log(`🔍 ${label} - Offers:`, response?.data?.offers);
  console.log(`🔍 ${label} - First offer:`, response?.data?.offers?.[0]);
  if (response?.data?.offers?.[0]) {
    debugOfferStructure(response.data.offers[0], `${label} - First Offer`);
  }
};
