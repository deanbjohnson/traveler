import { cohere } from "@ai-sdk/cohere";
import { streamText } from "ai";
import { auth } from "@clerk/nextjs/server";
import { tools as originalTools } from "@/lib/tools";
import { ensureUserExists } from "@/lib/db";

// Allow streaming responses up to 60 seconds (increased from 30)
export const maxDuration = 60;

export async function POST(req: Request) {
  const requestStartTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[CHAT-${requestId}] === REQUEST START ===`);
  console.log(`[CHAT-${requestId}] Timestamp: ${new Date().toISOString()}`);

  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error(`[CHAT-${requestId}] JSON parse error in request body:`, {
        error: jsonError instanceof Error ? jsonError.message : String(jsonError),
        stack: jsonError instanceof Error ? jsonError.stack : undefined,
      });
      return new Response("Invalid JSON in request body", { status: 400 });
    }

    console.log(`[CHAT-${requestId}] Request body received:`, {
      messagesCount: body.messages?.length || 0,
      tripId: body.tripId,
      lastMessagePreview:
        body.messages?.[body.messages.length - 1]?.content?.substring(0, 100) +
        "...",
      bodyKeys: Object.keys(body),
    });

    const { messages, tripId, model, currentFlightResults } = body;

    if (!tripId) {
      console.error(`[CHAT-${requestId}] ERROR: Missing tripId in request`);
      console.log(
        `[CHAT-${requestId}] Request body:`,
        JSON.stringify(body, null, 2)
      );
      return new Response("tripId is required", { status: 400 });
    }

    console.log(`[CHAT-${requestId}] Processing request for tripId: ${tripId}`);

    // Get the authenticated user from Clerk
    console.log(`[CHAT-${requestId}] Checking authentication...`);
    const authStartTime = Date.now();
    const { userId } = await auth();
    const authDuration = Date.now() - authStartTime;

    console.log(`[CHAT-${requestId}] Auth result:`, {
      userId: userId || "NOT_AUTHENTICATED",
      authDurationMs: authDuration,
    });

    // Ensure user exists in database if authenticated
    if (userId) {
      console.log(`[CHAT-${requestId}] Ensuring user exists in database...`);
      const userEnsureStartTime = Date.now();
      await ensureUserExists(userId);
      const userEnsureDuration = Date.now() - userEnsureStartTime;
      console.log(
        `[CHAT-${requestId}] User ensure completed in ${userEnsureDuration}ms`
      );
    }

    // Get current date in mm/dd/yyyy format
    const currentDate = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    console.log(`[CHAT-${requestId}] Current date: ${currentDate}`);

    // Deep JSON inspection helper
    function deepInspectForJSON(obj: any, path: string = 'root', maxDepth: number = 3, currentDepth: number = 0): string[] {
      const errors: string[] = [];
      
      if (currentDepth > maxDepth) return errors;
      if (obj === null || obj === undefined || typeof obj !== 'object') return errors;

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          errors.push(...deepInspectForJSON(item, `${path}[${index}]`, maxDepth, currentDepth + 1));
        });
        return errors;
      }

      for (const [key, value] of Object.entries(obj)) {
        try {
          JSON.stringify(value);
        } catch (keyError) {
          const errorMsg = keyError instanceof Error ? keyError.message : String(keyError);
          errors.push(`${path}.${key}: ${errorMsg}`);
          errors.push(...deepInspectForJSON(value, `${path}.${key}`, maxDepth, currentDepth + 1));
        }
      }
      
      return errors;
    }

    const wrappedTools = Object.fromEntries(
      Object.entries(originalTools).map(([name, tool]) => [
        name,
        {
          ...tool,
          execute: async (...args: unknown[]) => {
            console.log(`[CHAT-${requestId}] 🔧 Tool ${name} starting execution...`);
            
            try {
              const result = await (
                tool.execute as (...args: unknown[]) => Promise<unknown>
              )(...args);
    
              console.log(`[CHAT-${requestId}] 🔧 Tool ${name} execution completed`);
    
              // RAW JSON DEBUGGING - Let's see the actual string that's failing
              try {
                const jsonString = JSON.stringify(result);
                console.log(`[CHAT-${requestId}] ✅ Tool ${name} JSON validation: OK (${jsonString.length} chars)`);
                
                if (name === 'addToTimeline') {
                  console.log(`[CHAT-${requestId}] 📋 AddToTimeline success summary`);
                }
                
                return result;
              } catch (jsonError) {
                console.error(`[CHAT-${requestId}] ❌ TOOL ${name} JSON SERIALIZATION ERROR:`);
                console.error(`[CHAT-${requestId}] Error message:`, jsonError instanceof Error ? jsonError.message : String(jsonError));
                
                // LOG THE RAW OBJECT STRUCTURE
                console.log(`[CHAT-${requestId}] 🔍 RAW RESULT TYPE:`, typeof result);
                console.log(`[CHAT-${requestId}] 🔍 RAW RESULT CONSTRUCTOR:`, result?.constructor?.name);
                
                if (result && typeof result === 'object') {
                  console.log(`[CHAT-${requestId}] 🔍 TOP-LEVEL KEYS:`, Object.keys(result));
                  
                  // Test each top-level property
                  for (const [key, value] of Object.entries(result)) {
                    try {
                      const propJson = JSON.stringify(value);
                      console.log(`[CHAT-${requestId}] ✅ Property "${key}": OK (${propJson.length} chars)`);
                    } catch (propError) {
                      console.error(`[CHAT-${requestId}] ❌ Property "${key}": FAILED`);
                      console.error(`[CHAT-${requestId}] Property error:`, propError instanceof Error ? propError.message : String(propError));
                      
                      // DRILL DOWN INTO THE FAILING PROPERTY
                      console.log(`[CHAT-${requestId}] 🔍 Property "${key}" details:`, {
                        type: typeof value,
                        constructor: value?.constructor?.name,
                        isArray: Array.isArray(value),
                        length: Array.isArray(value) ? value.length : 'N/A',
                        keys: value && typeof value === 'object' ? Object.keys(value).slice(0, 20) : 'N/A'
                      });
    
                      // If it's an array, check each item
                      if (Array.isArray(value)) {
                        console.log(`[CHAT-${requestId}] 🔍 Checking array "${key}" items...`);
                        value.slice(0, 10).forEach((item, index) => {
                          try {
                            JSON.stringify(item);
                            console.log(`[CHAT-${requestId}] ✅ ${key}[${index}]: OK`);
                          } catch (itemError) {
                            console.error(`[CHAT-${requestId}] ❌ ${key}[${index}]: FAILED - ${itemError}`);
                            
                            // LOG THE PROBLEMATIC ITEM
                            console.log(`[CHAT-${requestId}] 🚨 PROBLEMATIC ITEM ${key}[${index}]:`, {
                              type: typeof item,
                              constructor: item?.constructor?.name,
                              keys: item && typeof item === 'object' ? Object.keys(item) : 'primitive'
                            });
    
                            // If it's an object, check its properties
                            if (item && typeof item === 'object') {
                              for (const [subKey, subValue] of Object.entries(item)) {
                                try {
                                  JSON.stringify(subValue);
                                  console.log(`[CHAT-${requestId}] ✅ ${key}[${index}].${subKey}: OK`);
                                } catch (subError) {
                                  console.error(`[CHAT-${requestId}] 💥 FOUND THE CULPRIT: ${key}[${index}].${subKey}`);
                                  console.error(`[CHAT-${requestId}] 💥 CULPRIT ERROR:`, subError);
                                  console.log(`[CHAT-${requestId}] 💥 CULPRIT VALUE TYPE:`, typeof subValue);
                                  console.log(`[CHAT-${requestId}] 💥 CULPRIT VALUE CONSTRUCTOR:`, subValue?.constructor?.name);
                                  
                                  // Try to log a safe representation
                                  try {
                                    console.log(`[CHAT-${requestId}] 💥 CULPRIT VALUE (toString):`, String(subValue));
                                  } catch (stringError) {
                                    console.log(`[CHAT-${requestId}] 💥 CULPRIT VALUE: Cannot even convert to string!`);
                                  }
                                }
                              }
                            }
                          }
                        });
                      }
    
                      // If it's an object, check its properties
                      if (value && typeof value === 'object' && !Array.isArray(value)) {
                        console.log(`[CHAT-${requestId}] 🔍 Checking object "${key}" properties...`);
                        const entries = Object.entries(value).slice(0, 20);
                        for (const [subKey, subValue] of entries) {
                          try {
                            JSON.stringify(subValue);
                            console.log(`[CHAT-${requestId}] ✅ ${key}.${subKey}: OK`);
                          } catch (subError) {
                            console.error(`[CHAT-${requestId}] 💥 FOUND THE CULPRIT: ${key}.${subKey}`);
                            console.error(`[CHAT-${requestId}] 💥 CULPRIT ERROR:`, subError);
                            console.log(`[CHAT-${requestId}] 💥 CULPRIT VALUE TYPE:`, typeof subValue);
                            console.log(`[CHAT-${requestId}] 💥 CULPRIT VALUE:`, String(subValue));
                          }
                        }
                      }
                    }
                  }
                }
    
                // Return a completely safe object
                return {
                  success: false,
                  error: `Tool ${name} returned non-serializable data`,
                  details: jsonError instanceof Error ? jsonError.message : String(jsonError),
                  timestamp: new Date().toISOString(),
                };
              }
            } catch (error) {
              console.error(`[CHAT-${requestId}] Tool ${name} execution error:`, error);
              return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown tool error",
                timestamp: new Date().toISOString(),
              };
            }
          },
        },
      ])
    );
    
    // Use the wrapped tools with JSON validation
    const tools = wrappedTools;
    console.log(`[CHAT-${requestId}] Available tools:`, Object.keys(tools));

    const selectedModel = model || "command-a-03-2025";

    console.log(`[CHAT-${requestId}] Initializing streamText with:`, {
      model: selectedModel,
      maxSteps: 10,
      messagesCount: messages.length,
      toolsCount: Object.keys(tools).length,
      tripId,
      userId: userId || "guest",
    });

    const streamStartTime = Date.now();
    // Wrap tools to inject tripId and filter params automatically for tools that accept them
    const toolsWithTripId = Object.fromEntries(
      Object.entries(tools).map(([name, t]) => [
        name,
        {
          ...t,
          execute: async (...args: any[]) => {
            console.log(`[CHAT-${requestId}] 🔧 Tool ${name} starting execution...`);
            try {
              // Inject tripId and filter parameters if supported
              try {
                const first = args?.[0];
                if (first && typeof first === 'object') {
                  if (!('tripId' in first)) {
                    (first as any).tripId = tripId;
                  }
                  
                  // Inject filter parameters for budgetDiscovery tool
                  if (name === 'budgetDiscovery' && body.filters) {
                    const filters = body.filters;
                    if (filters.tripType && !('tripType' in first)) {
                      (first as any).tripType = filters.tripType;
                    }
                    if (filters.passengers && !('passengers' in first)) {
                      (first as any).passengers = filters.passengers;
                    }
                    if (filters.cabinClass && !('cabinClass' in first)) {
                      (first as any).cabinClass = filters.cabinClass;
                    }
                    if (filters.maxStops !== undefined && !('maxStops' in first)) {
                      (first as any).maxStops = filters.maxStops;
                    }
                    if (filters.priceFilter !== undefined && !('maxBudget' in first)) {
                      (first as any).maxBudget = filters.priceFilter;
                    }
                  }
                }
              } catch (_) {}

              const rawResult = await (t.execute as any)(...args);

              // Ensure result is JSON-serializable
              const jsonString = JSON.stringify(rawResult);
              console.log(`[CHAT-${requestId}] ✅ Tool ${name} JSON validation: OK (${jsonString.length} chars)`);
              return JSON.parse(jsonString);
            } catch (jsonError) {
              console.error(`[CHAT-${requestId}] ❌ Tool ${name} result not serializable:`, jsonError instanceof Error ? jsonError.message : String(jsonError));
              return {
                success: false,
                error: `Tool ${name} returned non-serializable data`,
                timestamp: new Date().toISOString(),
              };
            }
          },
        },
      ])
    );

    console.log(`[CHAT-${requestId}] Starting streamText with model: ${selectedModel}`);
    const result = streamText({
      model: cohere(selectedModel),
      maxSteps: 10,
      temperature: 0.7, // Add temperature to ensure the model generates responses
      system: `You are an intelligent travel assistant with advanced tools that can handle any type of travel request, from very specific to very general. Your goal is to understand user intentions and automatically use the right tools with the right parameters.

## Understanding User Objectives

**For flight searches**, you can handle:
- **Specific requests**: "Find flights from JFK to LAX on December 25th" → Use findFlight with exact airport codes and dates
- **General requests**: "I want to go somewhere warm in Asia for a week next month" → Use findFlight with regions, relative dates, and trip duration
- **Mixed requests**: "Find cheap flights from New York to anywhere in Europe in March" → Use findFlight with specific origins and flexible destinations
- **Complex requests**: "Show me options from California to Tokyo area, departing in the next 2 months for a 10-day trip" → Use findFlight with metro areas, date ranges, and duration
- **Budget discovery requests**: "Find the best deals to anywhere interesting in the next 6 months" → Use budgetDiscovery tool for comprehensive deal hunting

**For accommodations**: Handle specific cities, date ranges, guest counts, and preferences automatically.

**For itinerary management**: Always add relevant items to the user's trip timeline when they show interest in flights, hotels, or activities.

## Tool Usage Guidelines

**Flight Search (findFlight)**: Use for specific or semi-specific searches
- For specific searches: Use exact airport codes (JFK, LAX) and specific dates (2024-12-25)
- For flexible searches: Use regions (asia, europe), metro areas (new-york, tokyo), relative dates (next-month), and trip durations
- For multiple flights to a specific location: Use findFlight with date ranges (e.g., "next 6 months") to get multiple flight options to one destination
- Always infer missing details intelligently (default to economy class, 1 passenger, round-trip unless specified)

**Budget Discovery (budgetDiscovery)**: Use for comprehensive deal hunting and discovery
- Perfect for: "Find cheap flights to anywhere warm", "Show me the best deals to Asia", "What are the cheapest flights to Europe in the next 6 months?"
- Also for: "golf trip out of jfk", "beach vacation deals", "food destination flights", "cultural city trips"
- When users want to discover amazing deals without being too specific about dates or destinations
- When users mention activities/interests (golf, beach, food, culture, etc.) rather than specific cities
- When users say "anywhere", "interesting", "best deals", "cheap flights to anywhere"

**Location-Specific Multiple Flights (findFlight)**: Use when users want multiple flight options to a specific destination
- Perfect for: "Find 10 flights to Miami", "Show me flights to Paris over the next 6 months", "What are the flight options to Tokyo?"
- Use findFlight with date ranges (e.g., "next 6 months") to get multiple flight options to one destination
- This is different from budgetDiscovery which searches multiple destinations

CRITICAL: For budgetDiscovery, you MUST:
1. First generate a list of EXACTLY 5 relevant destinations based on the user's query
2. Include the IATA airport code for each destination
3. Call budgetDiscovery with the destinations array (max 5 destinations)

Example budgetDiscovery call:
\`\`\`json
{
  "from": "JFK",
  "destinationSuggestion": "golf trip out of jfk",
  "destinations": [
    {"name": "Scottsdale", "airport": "PHX", "country": "United States", "category": "golf"},
    {"name": "Palm Springs", "airport": "PSP", "country": "United States", "category": "golf"},
    {"name": "Myrtle Beach", "airport": "MYR", "country": "United States", "category": "golf"},
    {"name": "Pebble Beach", "airport": "MRY", "country": "United States", "category": "golf"},
    {"name": "Orlando", "airport": "MCO", "country": "United States", "category": "golf"}
  ],
  "timeFrame": "6-months",
  "tripType": "round-trip",
  "passengers": 1,
  "cabinClass": "economy"
}
\`\`\`

**Stay Search**: Use findStay for accommodation requests with location, dates, and guest details.

**Timeline Management**: Use addToTimeline to save any flights, hotels, or activities the user expresses interest in. This is critical for building the user's itinerary. 

CRITICAL WORKFLOW FOR FLIGHTS:
- You MUST first search for flights using findFlight OR budgetDiscovery tool to get actual flight offers
- You CANNOT create generic flight objects - you must use the complete flight offer data from search results
- When adding flights to timeline, use the EXACT flightData object returned from findFlight (DuffelOffer format)
- The flightData must contain the full flight structure with slices, segments, origin/destination airports, etc.

NEVER create flight objects manually - always use actual search results from findFlight or budgetDiscovery tools.

## Data Structure Requirements

### DuffelOffer Structure (Required for addToTimeline flights)
Flight data from findFlight returns DuffelOffer objects with this EXACT structure:
\`\`\`typescript
{
  id: string,                    // Unique offer ID
  total_amount: string,          // Price as string (e.g., "187.53")
  total_currency: string,        // Currency code (e.g., "USD")
  tax_amount?: string,           // Tax amount
  tax_currency?: string,         // Tax currency
  slices: [                      // Array of flight segments
    {
      id: string,
      origin: {
        id: string,
        iata_code: string,       // Airport code (e.g., "JFK")
        name: string             // Airport name
      },
      destination: {
        id: string,
        iata_code: string,       // Airport code (e.g., "LAX")
        name: string             // Airport name
      },
      departure_datetime: string, // ISO datetime
      arrival_datetime: string,   // ISO datetime
      duration: string,           // ISO duration (e.g., "PT2H30M")
      segments: [                 // Individual flight segments
        {
          id: string,
          aircraft: { name: string },
          operating_carrier: {
            name: string,         // Airline name
            iata_code: string     // Airline code
          },
          marketing_carrier: {
            name: string,
            iata_code: string
          },
          duration: string,
          origin: {
            iata_code: string,
            name: string
          },
          destination: {
            iata_code: string,
            name: string
          },
          departure_datetime: string,
          arrival_datetime: string
        }
      ]
    }
  ],
  passengers: [
    {
      id: string,
      type: string               // "adult", "child", "infant"
    }
  ],
  owner: {
    name: string,                // Airline name
    iata_code: string            // Airline code
  },
  expires_at: string,            // ISO datetime
  created_at: string,            // ISO datetime
  updated_at: string             // ISO datetime
}
\`\`\`

### Stay Data Structure (for addToTimeline stays)
Stay data from findStay returns accommodation objects with properties like:
\`\`\`typescript
{
  id: string,
  name: string,
  location: {
    latitude: number,
    longitude: number,
    address: string
  },
  rates: [
    {
      total_amount: string,
      currency: string,
      cancellation_policy: object
    }
  ],
  amenities: string[],
  photos: string[]
}
\`\`\`

### addToTimeline Item Structure
When calling addToTimeline, items must have this structure:
\`\`\`typescript
{
  type: "FLIGHT" | "STAY" | "ACTIVITY" | "DINING" | "TRANSPORT" | "FREE_TIME" | "CUSTOM",
  title: string,                          // e.g., "Flight JFK → LAX"
  description?: string,                   // Optional description
  startTime: string,                      // ISO datetime (e.g., "2024-08-25T20:29:00")
  endTime?: string,                       // ISO datetime (optional)
  duration?: number,                      // Duration in minutes (optional)
  
  // For FLIGHT items - REQUIRED:
  flightData: DuffelOffer,                // Complete DuffelOffer object from findFlight
  
  // For STAY items - REQUIRED:
  stayData: Record<string, unknown>,      // Complete stay object from findStay
  
  // For other items - OPTIONAL:
  activityData?: Record<string, unknown>, // Activity-specific data
  
  locationId?: string                     // Optional location ID
}
\`\`\`

### Guest Structure (for findStay)
\`\`\`typescript
{
  type: "adult" | "child",
  age?: number                            // Required for children (0-17)
}
\`\`\`

## Response Strategy

1. **Parse the request** to understand what the user wants (specific vs general, trip type, preferences)
2. **Use tools immediately** - don't ask for clarification on obvious details
3. **Make intelligent assumptions** based on context (if they say "next month", calculate the actual month)
4. **Present results clearly** with key information highlighted
5. **Automatically add items** to the timeline when a user shows interest (e.g., "that flight looks good" or "book this hotel"). This is a primary function.
6. **Offer helpful suggestions** for next steps or alternatives

## Important Workflow Notes

- If a user says "add a flight to my timeline" without specifying which flight, you should:
  1. First ask where they want to go and when
  2. Search for flights using findFlight or budgetDiscovery
  3. Present options to the user
  4. Once they select a specific flight, use addToTimeline to save it
- You cannot add generic items to the timeline - you need actual flight/hotel data from search results
- CRITICAL: When a user says "add it to my timeline" or "add that flight" after you've shown flight results, you MUST immediately use the addToTimeline tool with the flight data from the most recent search
- When you present flight options and the user picks one (e.g., "the first one", "the cheapest one", "add it"), you MUST use addToTimeline immediately

FLIGHT DATA REQUIREMENTS:
- Flight data MUST come from findFlight or budgetDiscovery tool results (DuffelOffer objects)
- Flight data MUST contain: id, slices[], total_amount, total_currency, owner
- Each slice MUST contain: origin, destination, departure_datetime, arrival_datetime, duration, segments[]
- DO NOT create flight objects with generic properties like "airline", "price", "departure" - use actual API data structure

## Key Behaviors

- **Be proactive**: If someone says "I want to go to Japan", immediately search for flights to tokyo area
- **Handle ambiguity**: "Cheap flights to Europe" → search for europe region with sortBy: "cheapest"
- **Budget discovery**: When users say things like "find me the best deals", "show me cheap flights to anywhere", "what are the best flight deals", "golf trip", "beach vacation", use the budgetDiscovery tool
- **Context awareness**: Remember previous searches and user preferences in the conversation
- **Natural language**: Parse human expressions like "next month", "for a week", "somewhere warm"
- **Comprehensive help**: Suggest related searches, alternative dates, nearby airports when appropriate

Current date: ${currentDate}
Current trip ID: ${tripId} (include this as the "tripId" parameter whenever you call the addToTimeline tool)
${
        userId ? `User: Authenticated (${userId})` : "User: Guest (not authenticated)"
      }

Remember: You have access to powerful tools that can handle complex travel requests. Use them proactively to provide comprehensive, helpful responses.

EXAMPLE WORKFLOW:
User: "Find flights from NYC to SF in August"
You: [Use findFlight tool to search] "Here are the flights I found..."
User: "Add the cheapest one to my timeline" or "add it to my timeline"
You: [MUST use addToTimeline tool with the flight data] "I've added the Hawaiian Airlines flight on August 19 for $187.53 to your timeline!"

EXAMPLE BUDGET DISCOVERY WORKFLOW:
User: "golf trip out of jfk"
You: [Use budgetDiscovery tool with golf destinations] "I'll search for golf destinations from JFK. Here are the best deals I found..."
User: "Add the Scottsdale flight to my timeline"
You: [MUST use addToTimeline tool with the flight data] "I've added the flight to Scottsdale for $XXX to your timeline!"`,
      tools: toolsWithTripId,
      messages,
    });

    const streamInitDuration = Date.now() - streamStartTime;
    console.log(
      `[CHAT-${requestId}] StreamText initialized in ${streamInitDuration}ms`
    );

    const totalRequestDuration = Date.now() - requestStartTime;
    console.log(
      `[CHAT-${requestId}] Total request processing time: ${totalRequestDuration}ms`
    );
    console.log(`[CHAT-${requestId}] === REQUEST PROCESSING COMPLETE ===`);

    try {
      const response = result.toDataStreamResponse();
      console.log(`[CHAT-${requestId}] Response stream created successfully`);
      
      // Add debugging to see if the stream is actually being consumed
      console.log(`[CHAT-${requestId}] Stream response headers:`, Object.fromEntries(response.headers.entries()));
      console.log(`[CHAT-${requestId}] Stream response status:`, response.status);
      
      return response;
    } catch (streamError) {
      console.error(`[CHAT-${requestId}] Stream response error:`, {
        error: streamError instanceof Error ? streamError.message : String(streamError),
        stack: streamError instanceof Error ? streamError.stack : undefined,
      });
      return new Response("Failed to create response stream", { status: 500 });
    }
  } catch (error) {
    const totalRequestDuration = Date.now() - requestStartTime;
    console.error(`[CHAT-${requestId}] === FATAL ERROR ===`);
    console.error(`[CHAT-${requestId}] Error type:`, error?.constructor?.name);
    console.error(
      `[CHAT-${requestId}] Error message:`,
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      `[CHAT-${requestId}] Error stack:`,
      error instanceof Error ? error.stack : "No stack trace available"
    );
    console.error(
      `[CHAT-${requestId}] Request duration before error: ${totalRequestDuration}ms`
    );
    console.error(`[CHAT-${requestId}] Timestamp: ${new Date().toISOString()}`);

    return new Response("Internal server error", { status: 500 });
  }
}