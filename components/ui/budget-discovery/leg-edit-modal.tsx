import React, { useState } from 'react';
import { Button } from '../button';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { Badge } from '../badge';
import { Input } from '../input';
import { Label } from '../label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../dialog';
import { 
  Plane, 
  Calendar, 
  DollarSign, 
  Clock,
  X,
  Search,
  Check
} from 'lucide-react';
import { FlightResult } from './types';
import { format, isValid, parseISO } from 'date-fns';
import { searchFlights } from '@/app/server/actions/flight-search';

interface LegEditModalProps {
  flight: FlightResult;
  legType: 'outbound' | 'return';
  flightIndex: number;
  onReplaceLeg: (data: { flight: FlightResult, legType: 'outbound' | 'return', newLeg: any, originalLeg: any, flightIndex: number }) => void;
  children: React.ReactNode;
}

interface ReplacementOption {
  id: string;
  price: string;
  currency: string;
  airline: string;
  route: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  cabinClass: string;
  offer: any;
}

// Helper function to safely format dates
const safeFormatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Invalid date';
  
  try {
    // Try parsing as ISO first, then as regular date
    let date = parseISO(dateString);
    if (!isValid(date)) {
      date = new Date(dateString);
    }
    
    if (isValid(date)) {
      return format(date, 'MMM dd, yyyy');
    }
    
    console.log('Invalid date string:', dateString);
    return 'Invalid date';
  } catch (error) {
    console.log('Date parsing error:', error, 'for string:', dateString);
    return 'Invalid date';
  }
};

export function LegEditModal({ flight, legType, flightIndex, onReplaceLeg, children }: LegEditModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editCriteria, setEditCriteria] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [replacementOptions, setReplacementOptions] = useState<ReplacementOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const legData = legType === 'outbound' 
    ? {
        route: `${flight.route.origin} → ${flight.route.destination}`,
        date: flight.dates.departure,
        duration: flight.duration.outbound
      }
    : {
        route: `${flight.route.destination} → ${flight.route.origin}`,
        date: flight.dates.return,
        duration: flight.duration.return
      };

  const handleSearchReplacements = async () => {
    if (!editCriteria.trim()) return;
    
    setIsSearching(true);
    setReplacementOptions([]);
    setSelectedOption(null);
    setHasSearched(true);

    try {
      // Parse the edit criteria to extract search parameters
      const searchParams = parseEditCriteria(editCriteria, legData);
      
      // Use server action to search for replacement flights
      const data = await searchFlights({
        from: legType === 'outbound' ? flight.route.origin : flight.route.destination,
        to: legType === 'outbound' ? flight.route.destination : flight.route.origin,
        date: (searchParams.date || legData.date).split('T')[0], // Convert to YYYY-MM-DD format
        passengers: 1,
        cabinClass: searchParams.cabinClass || 'economy'
      });
      
      // The server action returns a different format
      if (data.success && data.data) {
        // The server action returns offers directly in data.data
        const offers = data.data.offers || [];
        
        if (offers.length > 0) {
          const options = offers.slice(0, 5).map((offer: any) => ({
            id: offer.id || Math.random().toString(),
            price: offer.total_amount || 'N/A',
            currency: offer.total_currency || 'USD',
            airline: offer.owner?.name || 'Unknown',
            route: `${offer.slices?.[0]?.origin?.iata_code} → ${offer.slices?.[0]?.destination?.iata_code}`,
            departure: offer.slices?.[0]?.departure_datetime,
            arrival: offer.slices?.[0]?.arrival_datetime,
            duration: offer.slices?.[0]?.duration,
            stops: (offer.slices?.[0]?.segments?.length || 1) - 1,
            cabinClass: searchParams.cabinClass || 'economy',
            offer
          }));
          
          setReplacementOptions(options);
        } else {
          setReplacementOptions([]);
        }
      } else {
        setReplacementOptions([]);
      }
    } catch (error) {
      console.error('Error searching for replacements:', error);
      setReplacementOptions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReplaceLeg = () => {
    if (!selectedOption) return;
    
    const option = replacementOptions.find(opt => opt.id === selectedOption);
    if (option) {
      onReplaceLeg({
        flight,
        legType,
        newLeg: option,
        originalLeg: legData,
        flightIndex
      });
      setIsOpen(false);
    }
  };

  const parseEditCriteria = (criteria: string, legData: any) => {
    const params: any = {};
    
    // Parse date changes
    const dateMatch = criteria.match(/date to (\d{4}-\d{2}-\d{2})/i);
    if (dateMatch) {
      params.date = dateMatch[1];
    }
    
    // Parse cabin class changes
    if (criteria.toLowerCase().includes('first class')) {
      params.cabinClass = 'first';
    } else if (criteria.toLowerCase().includes('business class')) {
      params.cabinClass = 'business';
    } else if (criteria.toLowerCase().includes('premium economy')) {
      params.cabinClass = 'premium_economy';
    }
    
    // Parse direct flight requests
    if (criteria.toLowerCase().includes('direct')) {
      params.maxStops = 0;
    }
    
    // Parse price constraints
    const priceMatch = criteria.match(/under \$(\d+)/i);
    if (priceMatch) {
      params.maxPrice = parseInt(priceMatch[1]);
    }
    
    return params;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        // Reset state when modal closes
        setEditCriteria('');
        setReplacementOptions([]);
        setSelectedOption(null);
        setHasSearched(false);
      }
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="leg-edit-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Edit {legType === 'outbound' ? 'Outbound' : 'Return'} Leg
          </DialogTitle>
          <p id="leg-edit-description" className="text-sm text-gray-500">
            Describe how you want to change this flight leg (e.g., "change date to September 16th, upgrade to first class")
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Leg Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current {legType === 'outbound' ? 'Outbound' : 'Return'} Leg</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{legData.route}</Badge>
                    <span className="text-sm text-gray-400">
                      {safeFormatDate(legData.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {legData.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Economy
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Criteria Input */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How do you want to change this leg?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="edit-criteria">Describe your changes:</Label>
                <Input
                  id="edit-criteria"
                  placeholder="e.g., change date to 2025-10-15, upgrade to first class, find direct flight, under $1000"
                  value={editCriteria}
                  onChange={(e) => setEditCriteria(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div className="text-sm text-gray-400">
                <p>Examples:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li>"change date to 2025-10-15"</li>
                  <li>"upgrade to first class"</li>
                  <li>"find direct flight"</li>
                  <li>"under $1000"</li>
                  <li>"business class on 2025-10-20"</li>
                </ul>
              </div>

              <Button 
                onClick={handleSearchReplacements}
                disabled={!editCriteria.trim() || isSearching}
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Replacement Options
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Replacement Options */}
          {replacementOptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Replacement Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {replacementOptions.map((option) => (
                    <div
                      key={option.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedOption === option.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedOption(option.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{option.route}</Badge>
                            <span className="text-sm text-gray-400">
                              {safeFormatDate(option.departure)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {option.duration}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {option.cabinClass}
                            </span>
                            <span>{option.stops} stop{option.stops !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {option.currency} {option.price}
                          </div>
                          <div className="text-sm text-gray-400">
                            {option.airline}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedOption && (
                  <div className="mt-4 flex gap-2">
                    <Button onClick={handleReplaceLeg} className="flex-1">
                      <Check className="mr-2 h-4 w-4" />
                      Replace This Leg
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedOption(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {replacementOptions.length === 0 && !isSearching && hasSearched && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-400">No replacement options found. Try different criteria.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
