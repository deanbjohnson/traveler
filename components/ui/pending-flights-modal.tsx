'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plane, Calendar, Clock, MapPin, User, Check, X } from 'lucide-react';
import { format } from 'date-fns';

interface ParsedFlightData {
  airline?: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  confirmationCode?: string;
  passengerName?: string;
  bookingReference?: string;
}

interface PendingFlight {
  id: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string;
  parsedData: ParsedFlightData;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
  assignedTripId?: string;
}

interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
}

interface PendingFlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId?: string;
}

export function PendingFlightsModal({ isOpen, onClose, tripId }: PendingFlightsModalProps) {
  const [pendingFlights, setPendingFlights] = useState<PendingFlight[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetchPendingFlights();
      fetchTrips();
    }
  }, [isOpen]);

  const fetchPendingFlights = async () => {
    try {
      const response = await fetch('/api/pending-flights');
      if (response.ok) {
        const data = await response.json();
        setPendingFlights(data.pendingFlights);
      }
    } catch (error) {
      console.error('Error fetching pending flights:', error);
    }
  };

  const fetchTrips = async () => {
    try {
      const response = await fetch('/api/trips');
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips);
      }
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  };

  const handleAssignToTrip = async (flightId: string, tripId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/pending-flights/${flightId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId })
      });

      if (response.ok) {
        // Refresh the pending flights list
        await fetchPendingFlights();
        setSelectedTrips(prev => ({ ...prev, [flightId]: tripId }));
      }
    } catch (error) {
      console.error('Error assigning flight to trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectFlight = async (flightId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/pending-flights/${flightId}/reject`, {
        method: 'POST'
      });

      if (response.ok) {
        await fetchPendingFlights();
      }
    } catch (error) {
      console.error('Error rejecting flight:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFlightInfo = (flight: PendingFlight) => {
    const data = flight.parsedData;
    return {
      route: data.origin && data.destination ? `${data.origin} → ${data.destination}` : 'Route not found',
      airline: data.airline || 'Airline not found',
      flightNumber: data.flightNumber || 'Flight number not found',
      departure: data.departureDate && data.departureTime ? 
        `${data.departureDate} at ${data.departureTime}` : 
        data.departureDate || 'Departure not found',
      confirmation: data.confirmationCode || data.bookingReference || 'No confirmation code',
      passenger: data.passengerName || 'Passenger not found'
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW':
        return <Badge variant="secondary">Pending Review</Badge>;
      case 'APPROVED':
        return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'PROCESSED':
        return <Badge variant="outline">Processed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Pending Flights from Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {pendingFlights.length === 0 ? (
            <div className="text-center py-8">
              <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No pending flights found</p>
              <p className="text-sm text-gray-400 mt-2">
                Forward your booking emails to your Inbound.new address to see them here
              </p>
            </div>
          ) : (
            pendingFlights.map((flight) => {
              const flightInfo = formatFlightInfo(flight);
              const isAssigned = flight.assignedTripId || selectedTrips[flight.id];
              
              return (
                <Card key={flight.id} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {flightInfo.airline} {flightInfo.flightNumber}
                          {getStatusBadge(flight.status)}
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">{flight.emailSubject}</p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>From: {flight.emailFrom}</p>
                        <p>{format(new Date(flight.emailDate), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{flightInfo.route}</p>
                          <p className="text-xs text-gray-500">Route</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{flightInfo.departure}</p>
                          <p className="text-xs text-gray-500">Departure</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium">{flightInfo.passenger}</p>
                          <p className="text-xs text-gray-500">Passenger</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-sm font-medium">{flightInfo.confirmation}</p>
                          <p className="text-xs text-gray-500">Confirmation</p>
                        </div>
                      </div>
                    </div>

                    {flight.status === 'PENDING_REVIEW' && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Select
                            value={selectedTrips[flight.id] || ''}
                            onValueChange={(value) => setSelectedTrips(prev => ({ ...prev, [flight.id]: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a trip to assign this flight to..." />
                            </SelectTrigger>
                            <SelectContent>
                              {trips.map((trip) => (
                                <SelectItem key={trip.id} value={trip.id}>
                                  {trip.title} - {trip.destination}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <Button
                          onClick={() => handleAssignToTrip(flight.id, selectedTrips[flight.id])}
                          disabled={!selectedTrips[flight.id] || loading}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Assign to Trip
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => handleRejectFlight(flight.id)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {isAssigned && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          ✓ Flight assigned to trip
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
