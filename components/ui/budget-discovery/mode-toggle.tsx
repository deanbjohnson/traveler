import React from 'react';
import { ChatMode } from './types';

interface ModeToggleProps {
  chatMode: ChatMode;
  tripId: string;
  onModeChange: (mode: ChatMode) => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ chatMode, tripId, onModeChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => {
          onModeChange('trip-discover');
          localStorage.setItem(`bd-chatMode-${tripId}`, 'trip-discover');
        }}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          chatMode === 'trip-discover'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Trip Discover
      </button>
      <button
        onClick={() => {
          onModeChange('specific-flight');
          localStorage.setItem(`bd-chatMode-${tripId}`, 'specific-flight');
        }}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          chatMode === 'specific-flight'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
      >
        Specific Flight
      </button>
    </div>
  );
};
