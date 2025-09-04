import React from 'react';
import { ChevronDown } from 'lucide-react';
import { TripType, CabinClass } from './types';

interface FilterControlsProps {
  tripType: TripType;
  passengers: number;
  cabinClass: CabinClass;
  maxStops: number | null;
  priceFilter: number | null;
  onTripTypeChange: (tripType: TripType) => void;
  onPassengersChange: (passengers: number) => void;
  onCabinClassChange: (cabinClass: CabinClass) => void;
  onMaxStopsChange: (maxStops: number | null) => void;
  onPriceFilterChange: (priceFilter: number | null) => void;
  tripId: string;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  tripType,
  passengers,
  cabinClass,
  maxStops,
  priceFilter,
  onTripTypeChange,
  onPassengersChange,
  onCabinClassChange,
  onMaxStopsChange,
  onPriceFilterChange,
  tripId,
}) => {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {/* Trip Type */}
      <div className="relative">
        <select
          value={tripType}
          onChange={(e) => {
            onTripTypeChange(e.target.value as TripType);
            localStorage.setItem(`bd-tripType-${tripId}`, e.target.value);
          }}
          className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="round-trip">Round trip</option>
          <option value="one-way">One way</option>
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Passengers */}
      <div className="relative">
        <select
          value={passengers}
          onChange={(e) => {
            onPassengersChange(Number(e.target.value));
            localStorage.setItem(`bd-passengers-${tripId}`, e.target.value);
          }}
          className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {[1, 2, 3, 4, 5, 6].map(num => (
            <option key={num} value={num}>{num} {num === 1 ? 'passenger' : 'passengers'}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Cabin Class */}
      <div className="relative">
        <select
          value={cabinClass}
          onChange={(e) => {
            onCabinClassChange(e.target.value as CabinClass);
            localStorage.setItem(`bd-cabinClass-${tripId}`, e.target.value);
          }}
          className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="economy">Economy</option>
          <option value="premium_economy">Premium Economy</option>
          <option value="business">Business</option>
          <option value="first">First Class</option>
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Stops */}
      <div className="relative">
        <select
          value={maxStops ?? ''}
          onChange={(e) => {
            const value = e.target.value === '' ? null : Number(e.target.value);
            onMaxStopsChange(value);
            localStorage.setItem(`bd-maxStops-${tripId}`, value?.toString() ?? '');
          }}
          className="appearance-none bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Any stops</option>
          <option value="0">Direct only</option>
          <option value="1">Max 1 stop</option>
          <option value="2">Max 2 stops</option>
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Price */}
      <input
        type="number"
        placeholder="Any price"
        value={priceFilter?.toString() ?? ''}
        onChange={(e) => {
          const value = e.target.value === '' ? null : Number(e.target.value);
          onPriceFilterChange(value);
          localStorage.setItem(`bd-priceFilter-${tripId}`, value?.toString() ?? '');
        }}
        className="bg-gray-800 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
        min="0"
        step="50"
      />
    </div>
  );
};
