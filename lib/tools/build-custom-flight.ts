import { tool } from "ai";
import { z } from "zod";
import { searchFlights } from "@/app/actions/flight-search";

export const buildCustomFlightTool = tool({
  description: `
    Build custom flight combinations by mixing and matching different legs.
    Use this when users want to create their own trip by combining different flight options.
    
    Examples:
    - "Change the return leg to first class"
    - "Find a direct flight for the outbound leg"
    - "Show me cheaper alternatives for the return"
    - "I want to leave a day earlier but keep the same return"
    - "Build me a custom trip with these criteria"
  `,
  parameters: z.object({
    baseFlight: z.object({
      id: z.string().describe("ID of the base flight to modify"),
      outbound: z.object({
        from: z.string(),
        to: z.string(),
        date: z.string(),
        airline: z.string().optional(),
        price: z.number().optional(),
        stops: z.number().optional(),
        cabinClass: z.string().optional(),
      }),
      return: z.object({
        from: z.string(),
        to: z.string(),
        date: z.string(),
        airline: z.string().optional(),
        price: z.number().optional(),
        stops: z.number().optional(),
        cabinClass: z.string().optional(),
      }),
    }),
    modifications: z.object({
      outbound: z.object({
        replace: z.boolean().optional().describe("Whether to replace the outbound leg"),
        newCriteria: z.object({
          date: z.string().optional(),
          cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
          preferDirect: z.boolean().optional(),
          maxStops: z.number().optional(),
          maxPrice: z.number().optional(),
          preferredAirlines: z.array(z.string()).optional(),
        }).optional(),
      }).optional(),
      return: z.object({
        replace: z.boolean().optional().describe("Whether to replace the return leg"),
        newCriteria: z.object({
          date: z.string().optional(),
          cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
          preferDirect: z.boolean().optional(),
          maxStops: z.number().optional(),
          maxPrice: z.number().optional(),
          preferredAirlines: z.array(z.string()).optional(),
        }).optional(),
      }).optional(),
    }),
    userRequest: z.string().optional().describe("The user's original request for context"),
  }),
  
  execute: async ({ baseFlight, modifications, userRequest }) => {
    console.log(`🔧 Building custom flight from base: ${baseFlight.id}`);
    console.log(`📋 Modifications:`, modifications);
    
    try {
      const results = {
        originalFlight: baseFlight,
        customOptions: [] as any[],
        totalPrice: 0,
        priceDifference: 0,
      };
      
      // 1. Determine which legs need to be replaced
      const outboundNeedsReplacement = modifications.outbound?.replace;
      const returnNeedsReplacement = modifications.return?.replace;
      
      if (!outboundNeedsReplacement && !returnNeedsReplacement) {
        return {
          success: false,
          error: "No modifications specified",
        };
      }
      
      // 2. Search for new outbound leg if needed
      let newOutbound = baseFlight.outbound;
      if (outboundNeedsReplacement && modifications.outbound?.newCriteria) {
        const outboundSearch = await searchFlights({
          from: baseFlight.outbound.from,
          to: baseFlight.outbound.to,
          departure: modifications.outbound.newCriteria.date || baseFlight.outbound.date,
          passengers: 1,
          cabinClass: modifications.outbound.newCriteria.cabinClass || "economy",
          maxStops: modifications.outbound.newCriteria.maxStops,
        });
        
        if (outboundSearch.success && outboundSearch.data?.offers?.length) {
          // Pick the best option based on criteria
          newOutbound = selectBestOption(outboundSearch.data.offers, modifications.outbound.newCriteria);
        }
      }
      
      // 3. Search for new return leg if needed
      let newReturn = baseFlight.return;
      if (returnNeedsReplacement && modifications.return?.newCriteria) {
        const returnSearch = await searchFlights({
          from: baseFlight.return.from,
          to: baseFlight.return.to,
          departure: modifications.return.newCriteria.date || baseFlight.return.date,
          passengers: 1,
          cabinClass: modifications.return.newCriteria.cabinClass || "economy",
          maxStops: modifications.return.newCriteria.maxStops,
        });
        
        if (returnSearch.success && returnSearch.data?.offers?.length) {
          // Pick the best option based on criteria
          newReturn = selectBestOption(returnSearch.data.offers, modifications.return.newCriteria);
        }
      }
      
      // 4. Calculate new total price
      const originalPrice = (baseFlight.outbound.price || 0) + (baseFlight.return.price || 0);
      const newPrice = (newOutbound.price || 0) + (newReturn.price || 0);
      
      // 5. Build custom flight options
      const customFlight = {
        id: `custom-${Date.now()}`,
        outbound: newOutbound,
        return: newReturn,
        totalPrice: newPrice,
        priceDifference: newPrice - originalPrice,
        changes: {
          outbound: outboundNeedsReplacement ? "replaced" : "unchanged",
          return: returnNeedsReplacement ? "replaced" : "unchanged",
        },
      };
      
      return {
        success: true,
        message: `Built custom flight combination based on your criteria`,
        customFlight,
        originalFlight: baseFlight,
        comparison: {
          originalPrice,
          newPrice,
          priceDifference: newPrice - originalPrice,
          savings: originalPrice - newPrice > 0 ? originalPrice - newPrice : 0,
        },
        nextSteps: [
          "Review the custom flight combination above",
          "Say 'Add this custom trip' to add it to your timeline",
          "Or ask for different modifications like 'Make it cheaper'"
        ]
      };
      
    } catch (error) {
      console.error('Build custom flight error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build custom flight',
      };
    }
  }
});

// Helper function to select the best option from search results
function selectBestOption(offers: any[], criteria: any) {
  if (!offers.length) return null;
  
  // Simple selection logic - could be made more sophisticated
  let bestOffer = offers[0];
  
  // Prefer direct flights if requested
  if (criteria.preferDirect) {
    const directFlights = offers.filter(offer => 
      offer.slices?.[0]?.segments?.length === 1
    );
    if (directFlights.length > 0) {
      bestOffer = directFlights[0];
    }
  }
  
  // Prefer cheaper options if price is a concern
  if (criteria.maxPrice) {
    const affordableFlights = offers.filter(offer => 
      parseFloat(offer.total_amount) <= criteria.maxPrice
    );
    if (affordableFlights.length > 0) {
      bestOffer = affordableFlights[0];
    }
  }
  
  // Convert to our format
  return {
    from: bestOffer.slices?.[0]?.origin?.iata_code,
    to: bestOffer.slices?.[0]?.destination?.iata_code,
    date: bestOffer.slices?.[0]?.departure_datetime,
    airline: bestOffer.owner?.name,
    price: parseFloat(bestOffer.total_amount),
    stops: (bestOffer.slices?.[0]?.segments?.length || 1) - 1,
    cabinClass: criteria.cabinClass || "economy",
    offerId: bestOffer.id,
  };
}
