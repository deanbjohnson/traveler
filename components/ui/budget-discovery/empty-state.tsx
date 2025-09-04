import React from 'react';
import { Search, Plane } from 'lucide-react';

interface EmptyStateProps {
  mode: 'trip-discover' | 'specific-flight';
}

export const EmptyState: React.FC<EmptyStateProps> = ({ mode }) => {
  if (mode === 'specific-flight') {
    return (
      <div className="text-center py-12">
        <Plane className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 mb-2">No flights found yet</p>
        <p className="text-sm text-gray-500">
          Use the search form on the left to find flights
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Search className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">
          No trips found. Try searching for flights or destinations!
        </p>
      </div>
    </div>
  );
};
