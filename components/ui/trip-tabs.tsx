"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Calendar, MapPin, Clock, Plane, Hotel, Car } from "lucide-react";
import MainTimeline from "@/components/main-timeline";
import { ChatDemo } from "@/components/chat-demo";
import { AITripSummary } from "@/components/ui/ai-trip-summary";
import type { TimelineData } from "@/components/main-timeline";

interface TripTabsProps {
  tripId: string;
  timeline: TimelineData;
  tripData?: any;
}

export function TripTabs({ tripId, timeline, tripData }: TripTabsProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'overview'>('timeline');

  const tabs = [
    {
      id: 'timeline',
      label: 'Timeline',
      icon: Clock,
      description: 'View your trip itinerary'
    },
    {
      id: 'overview',
      label: 'Trip Overview',
      icon: MapPin,
      description: 'Trip details and summary'
    }
  ];

  return (
    <div className="flex flex-col h-full w-full">
      {/* Tab Navigation */}
      <div className="border-b border-gray-700 bg-gray-900/50">
        <div className="flex space-x-8 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'timeline' | 'overview')}
                className={cn(
                  "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'timeline' && (
          <div className="flex h-full">
            <div className="flex-1 min-w-0 overflow-hidden">
              {/* Chat Demo */}
              <ChatDemo tripId={tripId} />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              {/* Timeline */}
              <MainTimeline timeline={timeline} tripId={tripId} />
            </div>
          </div>
        )}
        
        {activeTab === 'overview' && (
          <div className="h-full overflow-auto bg-gray-900">
            <div className="p-6">
              <div className="text-sm text-gray-400 mb-6">
                {tabs.find(t => t.id === 'overview')?.description}
              </div>
              
              {/* Trip Overview Content */}
              <div className="space-y-6">
                {/* AI Trip Summary */}
                <AITripSummary timeline={timeline} tripData={tripData} tripId={tripId} />

                {/* Timeline Items Summary */}
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Timeline Items</h3>
                  {timeline?.items && timeline.items.length > 0 ? (
                    <div className="space-y-3">
                      {timeline.items.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            {item.type === 'FLIGHT' && <Plane className="h-4 w-4 text-blue-400" />}
                            {item.type === 'STAY' && <Hotel className="h-4 w-4 text-green-400" />}
                            {item.type === 'TRANSPORT' && <Car className="h-4 w-4 text-yellow-400" />}
                            <div>
                              <p className="font-medium">{item.title}</p>
                              <p className="text-sm text-gray-400">
                                {new Date(item.startTime).toLocaleDateString()} at {new Date(item.startTime).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-600 rounded-full text-gray-300">
                            {item.type.toLowerCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-center py-8">No timeline items yet. Start planning your trip!</p>
                  )}
                </div>

                {/* Placeholder for Future Map */}
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4">Trip Map</h3>
                  <div className="bg-gray-700/50 rounded-lg p-8 text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-400">Map view coming soon!</p>
                    <p className="text-sm text-gray-500 mt-2">Interactive map showing your flight routes and destinations</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 