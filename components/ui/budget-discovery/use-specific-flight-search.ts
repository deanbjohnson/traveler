import { useState } from 'react';
import { toast } from 'sonner';
import { FlightResult, FlightSearchParams } from './types';
import { convertOffersToFlightResults } from './convert-offers';

export const useSpecificFlightSearch = () => {
  const [specificFlightSearchParams, setSpecificFlightSearchParams] = useState<FlightSearchParams | null>(null);
  const [specificFlightResults, setSpecificFlightResults] = useState<FlightResult[]>([]);
  const [isSpecificFlightLoading, setIsSpecificFlightLoading] = useState(false);

  const handleSpecificFlightSearch = async (searchParams: FlightSearchParams) => {
    console.log('🚀 Starting specific flight search with params:', searchParams);
    setSpecificFlightSearchParams(searchParams);
    setIsSpecificFlightLoading(true);
    
    try {
      if (!searchParams.departureDate) {
        throw new Error('Departure date is required');
      }
      
      const flightSearchParams = {
        from: searchParams.origin,
        to: searchParams.destination,
        departure: searchParams.departureDate.toISOString().split('T')[0],
        return: searchParams.returnDate ? searchParams.returnDate.toISOString().split('T')[0] : undefined,
        passengers: searchParams.passengers,
        cabinClass: searchParams.cabinClass,
        preferences: {
          maxPrice: searchParams.maxPrice,
          maxConnections: 2,
        }
      };
      
      console.log('🔍 Converted flight search params:', flightSearchParams);
      
      const searchQuery = `Search for flights from ${searchParams.origin} to ${searchParams.destination} on ${searchParams.departureDate.toISOString().split('T')[0]}${
        searchParams.returnDate ? ` returning on ${searchParams.returnDate.toISOString().split('T')[0]}` : ''
      } for ${searchParams.passengers} passenger${searchParams.passengers === 1 ? '' : 's'} in ${searchParams.cabinClass} class${
        searchParams.maxPrice ? ` with max price $${searchParams.maxPrice}` : ''
      }.`;
      
      console.log('🔍 Search query:', searchQuery);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: searchQuery }],
          tripId: 'temp', // This will be passed from parent
          id: `budget-discovery-temp-specific-flight`,
        }),
      });
      
      console.log('🔍 API response status:', response.status, response.statusText);
      
      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }
        
        let accumulatedData = '';
        let flightResults: FlightResult[] = [];
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            accumulatedData += chunk;
            
            console.log('🔍 Accumulated streaming data length:', accumulatedData.length);
            console.log('🔍 Accumulated streaming data preview:', accumulatedData.substring(0, 500));
          }
          
          console.log('🔍 Stream complete, attempting to parse accumulated data...');
          
          if (accumulatedData.includes('"offers":') || accumulatedData.includes('"result":')) {
            try {
              const parsed = JSON.parse(accumulatedData);
              console.log('📦 Parsed full response keys:', Object.keys(parsed));
              
              if (parsed.offers && Array.isArray(parsed.offers)) {
                console.log('✅ Found offers directly in response:', parsed.offers.length, 'offers');
                flightResults = convertOffersToFlightResults(parsed.offers, searchParams);
                setSpecificFlightResults(flightResults);
                console.log('✅ Flight results set in state (full parse):', flightResults.length);
              } else if (parsed.toolCall && parsed.toolCall.result && parsed.toolCall.result.offers) {
                console.log('✅ Found offers in tool call result:', parsed.toolCall.result.offers.length, 'offers');
                flightResults = convertOffersToFlightResults(parsed.toolCall.result.offers, searchParams);
                setSpecificFlightResults(flightResults);
                console.log('✅ Flight results set in state (full parse toolCall):', flightResults.length);
              } else {
                // Try to find offers anywhere in the structure
                const findOffersInObject = (obj: any, path: string = ''): any[] | null => {
                  if (Array.isArray(obj)) {
                    for (let i = 0; i < obj.length; i++) {
                      const result = findOffersInObject(obj[i], `${path}[${i}]`);
                      if (result) return result;
                    }
                  } else if (obj && typeof obj === 'object') {
                    if (obj.offers && Array.isArray(obj.offers)) {
                      console.log('🔍 Found offers at path:', path, 'with', obj.offers.length, 'offers');
                      return obj.offers;
                    }
                    for (const key in obj) {
                      const result = findOffersInObject(obj[key], `${path}.${key}`);
                      if (result) return result;
                    }
                  }
                  return null;
                };
                
                const foundOffers = findOffersInObject(parsed);
                if (foundOffers) {
                  console.log('✅ Found offers in nested structure:', foundOffers.length, 'offers');
                  flightResults = convertOffersToFlightResults(foundOffers, searchParams);
                  setSpecificFlightResults(flightResults);
                  console.log('✅ Flight results set in state (nested structure):', flightResults.length);
                }
              }
            } catch (fullParseError) {
              console.log('⚠️ Full response parse failed:', fullParseError);
              console.log('⚠️ Trying line-by-line parsing...');
              
              const lines = accumulatedData.split('\n');
              console.log('🔍 Processing', lines.length, 'lines for parsing');
              for (const line of lines) {
                if (line.includes('"offers":') || line.includes('"result":')) {
                  console.log('🔍 Processing line with offers/result:', line.substring(0, 200));
                  try {
                    let jsonStr = '';
                    
                    if (line.match(/^[a-z0-9]+:/)) {
                      const colonIndex = line.indexOf(':');
                      jsonStr = line.substring(colonIndex + 1);
                    } else if (line.includes('{') && line.includes('}')) {
                      jsonStr = line;
                    } else {
                      const jsonMatch = line.match(/\{[\s\S]*\}/);
                      if (jsonMatch) {
                        jsonStr = jsonMatch[0];
                      }
                    }
                    
                    if (jsonStr) {
                      console.log('🔍 Extracted JSON string:', jsonStr.substring(0, 200));
                      const parsed = JSON.parse(jsonStr);
                      console.log('🔍 Parsed line:', parsed);
                      
                      if (parsed.offers && Array.isArray(parsed.offers)) {
                        console.log('✅ Found offers in line:', parsed.offers.length, 'offers');
                        flightResults = convertOffersToFlightResults(parsed.offers, searchParams);
                        setSpecificFlightResults(flightResults);
                        console.log('✅ Flight results set in state (line parse direct offers):', flightResults.length);
                        break;
                      } else if (parsed.toolCall && parsed.toolCall.result && parsed.toolCall.result.offers) {
                        console.log('✅ Found offers in line:', parsed.toolCall.result.offers.length, 'offers');
                        flightResults = convertOffersToFlightResults(parsed.toolCall.result.offers, searchParams);
                        setSpecificFlightResults(flightResults);
                        console.log('✅ Flight results set in state (line parse toolCall offers):', flightResults.length);
                        break;
                      } else if (parsed.result && parsed.result.offers && Array.isArray(parsed.result.offers)) {
                        console.log('✅ Found offers in line:', parsed.result.offers.length, 'offers');
                        flightResults = convertOffersToFlightResults(parsed.result.offers, searchParams);
                        setSpecificFlightResults(flightResults);
                        console.log('✅ Flight results set in state (line parse result offers):', flightResults.length);
                        break;
                      }
                    }
                  } catch (lineParseError) {
                    console.log('❌ Error parsing line:', lineParseError, 'Line content:', line.substring(0, 100));
                  }
                }
              }
            }
          } else {
            console.log('🔍 No "offers" or "result" found in accumulated data');
          }
        } finally {
          reader.releaseLock();
        }
        
        console.log('🔍 After streaming loop - flightResults length:', flightResults.length);
        
        if (flightResults.length > 0) {
          toast.success(`Found ${flightResults.length} flights!`);
        } else {
          toast.error("No flights found for the specified criteria.");
        }
      } else {
        throw new Error('Failed to start search');
      }
    } catch (error) {
      console.error('Error starting specific flight search:', error);
      toast.error("Failed to start flight search.");
    } finally {
      setIsSpecificFlightLoading(false);
    }
  };

  return {
    specificFlightSearchParams,
    specificFlightResults,
    isSpecificFlightLoading,
    handleSpecificFlightSearch,
  };
};
