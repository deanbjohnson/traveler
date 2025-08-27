"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Plane, Hotel, Car, CreditCard, CheckCircle, Search, X } from "lucide-react";
import MainTimeline from "@/components/main-timeline";
import { ChatDemo } from "@/components/chat-demo";
import { AITripSummary } from "@/components/ui/ai-trip-summary";
import { TripMap } from "@/components/ui/trip-map";
import { BudgetDiscoveryTab } from "@/components/ui/budget-discovery-tab";
import { FlightDetailsModal } from "@/components/ui/flight-details-modal";
import { BookingFormModal } from "@/components/ui/booking-form-modal";
import { deleteTimelineItemAction } from "@/app/server/actions/delete-timeline-item";
import { bookTimelineFlight, bookAllTimelineFlights } from "@/app/server/actions/book-timeline-flight";
import type { TimelineData } from "@/components/main-timeline";

interface TripTabsProps {
  tripId: string;
  timeline: TimelineData;
  tripData?: any;
}

export function TripTabs({ tripId, timeline, tripData }: TripTabsProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'overview' | 'map' | 'budget-discovery'>('timeline');
  const [selectedFlightData, setSelectedFlightData] = useState<any>(null);
  const [selectedFlightTitle, setSelectedFlightTitle] = useState<string>('');
  const [showFlightDetails, setShowFlightDetails] = useState(false);
  const [bookingItems, setBookingItems] = useState<Set<string>>(new Set());
  const [isBooking, setIsBooking] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingItemId, setBookingItemId] = useState<string | null>(null);
  const [isBookingAll, setIsBookingAll] = useState(false);

  const handleBookItem = (itemId: string) => {
    setBookingItemId(itemId);
    setIsBookingAll(false);
    setShowBookingForm(true);
  };

  const handleBookAll = () => {
    setBookingItemId(null);
    setIsBookingAll(true);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = async (passengerInfo: any, paymentInfo: any) => {
    setIsBooking(true);
    try {
      if (isBookingAll) {
        const result = await bookAllTimelineFlights(tripId, passengerInfo);
        if (result.success) {
          const allItemIds = timeline?.items?.map(item => item.id) || [];
          setBookingItems(new Set(allItemIds));
          console.log('Booked all items:', result);
        } else {
          console.error('Booking all failed:', result);
          // Show a more helpful error message for expired offers
          if (result.results?.some(r => r.error?.includes('expired'))) {
            alert('Some flight offers have expired. Please search for flights again to get fresh offers.');
          } else {
            alert('Booking failed. Please try again.');
          }
        }
      } else if (bookingItemId) {
        const result = await bookTimelineFlight({
          tripId,
          itemId: bookingItemId,
          passengerDetails: passengerInfo,
        });
        if (result.success) {
          setBookingItems(prev => new Set([...prev, bookingItemId]));
          console.log(`Booked item: ${bookingItemId}`, result);
        } else {
          console.error('Booking failed:', result.error);
          // Show a more helpful error message for expired offers
          if (result.error?.includes('expired')) {
            alert('This flight offer has expired. Please search for flights again to get fresh offers.');
          } else {
            alert(`Booking failed: ${result.error}`);
          }
        }
      }
      setShowBookingForm(false);
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setIsBooking(false);
    }
  };

  const tabs = [
    {
      id: 'timeline',
      label: 'Chat',
      icon: Clock,
      description: 'Chat with AI and view timeline'
    },
    {
      id: 'budget-discovery',
      label: 'Budget Discovery',
      icon: Search,
      description: 'Discover amazing flight deals'
    },
    {
      id: 'overview',
      label: 'Trip Overview',
      icon: MapPin,
      description: 'Trip details and summary'
    },
    {
      id: 'map',
      label: 'Map View',
      icon: MapPin,
      description: 'Interactive map of your trip'
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
                onClick={() => setActiveTab(tab.id as 'timeline' | 'overview' | 'map' | 'budget-discovery')}
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
            <div className="flex-1 min-w-0 overflow-y-auto">
              {/* Timeline */}
              <MainTimeline 
                timeline={timeline} 
                tripId={tripId}
                editable
                onDeleteItem={async (itemId: string) => {
                  const res = await deleteTimelineItemAction({ tripId, itemId });
                  if (res.success) {
                    // soft refresh so UI updates
                    try { location.reload(); } catch (_) {}
                  } else {
                    console.error('Failed to delete item', res.error);
                  }
                }}
              />
            </div>
          </div>
        )}
        
        {activeTab === 'budget-discovery' && (
          <BudgetDiscoveryTab tripId={tripId} timeline={timeline} />
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Timeline Items</h3>
                    {timeline?.items && timeline.items.length > 0 && (
                      <Button
                        onClick={handleBookAll}
                        disabled={isBooking}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isBooking ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Booking All...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Book All ({timeline?.items?.length || 0})
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {timeline?.items && timeline.items.length > 0 ? (
                    <div className="space-y-3">
                      {(timeline.items || [])
                        .filter((it: any) => it.type !== 'LOCATION_CHANGE')
                        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                        .map((item: any, idx: number, arr: any[]) => {
                          const sameParentPrev = idx > 0 && arr[idx-1]?.parentId && arr[idx-1].parentId === item.parentId;
                          const sameParentNext = idx < arr.length-1 && arr[idx+1]?.parentId && arr[idx+1].parentId === item.parentId;
                          const showConnector = item.type === 'FLIGHT' && (sameParentPrev || sameParentNext);
                          return (
                            <div key={item.id} className="relative">
                              {showConnector && (
                                <div className="absolute -left-3 top-0 bottom-0 w-px bg-blue-300/50" />
                              )}
                              <div 
                                className={cn(
                                  "flex items-center justify-between p-3 bg-gray-700/50 rounded-lg",
                                  item.type === "FLIGHT" && item.flightData && "cursor-pointer transition-colors"
                                )}
                                onClick={() => {
                                  if (item.type === "FLIGHT" && item.flightData) {
                                    setSelectedFlightData(item.flightData);
                                    setSelectedFlightTitle(item.title);
                                    setShowFlightDetails(true);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    {item.type === "FLIGHT" && <Plane className="h-4 w-4 text-blue-400" />}
                                    {item.type === "STAY" && <Hotel className="h-4 w-4 text-green-400" />}
                                    {item.type === "TRANSPORT" && <Car className="h-4 w-4 text-yellow-400" />}
                                    {item.type === "ACTIVITY" && <Calendar className="h-4 w-4 text-purple-400" />}
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-gray-200">{item.title}</h4>
                                    {item.description && (
                                      <p className="text-sm text-gray-400">{item.description}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {bookingItems.has(item.id) && (
                                    <CheckCircle className="h-4 w-4 text-green-400" />
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const res = await deleteTimelineItemAction({ tripId, itemId: item.id });
                                      if (res.success) {
                                        try { location.reload(); } catch (_) {}
                                      }
                                    }}
                                    className="h-6 w-6 p-0 text-red-400 hover:text-red-500"
                                    aria-label="Remove item"
                                    title="Remove item"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  {item.type === "FLIGHT" && item.flightData && !bookingItems.has(item.id) && (
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBookItem(item.id);
                                      }}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      Book
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-gray-400">No items in timeline yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'map' && (
          <div className="h-full overflow-y-auto">
            <TripMap timeline={timeline} />
          </div>
        )}
      </div>

      {/* Flight Details Modal */}
      {showFlightDetails && selectedFlightData && (
        <FlightDetailsModal
          flightData={selectedFlightData}
          itemTitle={selectedFlightTitle}
          isOpen={showFlightDetails}
          onClose={() => setShowFlightDetails(false)}
        />
      )}

      {/* Booking Form Modal */}
      {showBookingForm && (
        <BookingFormModal
          isOpen={showBookingForm}
          onClose={() => setShowBookingForm(false)}
          onSubmit={handleBookingSubmit}
          isBooking={isBooking}
          isBookingAll={isBookingAll}
        />
      )}
    </div>
  );
} 