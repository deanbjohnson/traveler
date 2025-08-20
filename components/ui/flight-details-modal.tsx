"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, Clock, MapPin, Calendar, DollarSign, Users, ArrowRight } from "lucide-react";

interface FlightDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  flightData: any;
  itemTitle: string;
}

export function FlightDetailsModal({ isOpen, onClose, flightData, itemTitle }: FlightDetailsModalProps) {
  if (!flightData) return null;

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (isoDuration: string) => {
    // Parse ISO 8601 duration (e.g., "PT6H7M")
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (match) {
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      
      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else if (hours > 0) {
        return `${hours}h`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      }
    }
    return isoDuration;
  };

  const formatPrice = (amount: string, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(parseFloat(amount));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-blue-600" />
            Flight Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Flight Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{itemTitle}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {flightData.owner?.name || 'Unknown Airline'}
                </Badge>
                {flightData.total_amount && (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    <DollarSign className="h-3 w-3 mr-1" />
                    {formatPrice(flightData.total_amount, flightData.total_currency)}
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Flight Segments */}
          {flightData.slices && flightData.slices.map((slice: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Segment {index + 1}</span>
                  {slice.duration && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDuration(slice.duration)}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Route */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <div>
                        <div className="font-medium">{slice.origin?.name}</div>
                        <div className="text-sm text-gray-500">
                          {slice.origin?.iata_code} • {slice.origin?.city_name}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <ArrowRight className="h-4 w-4 text-gray-400 mx-4" />
                  
                  <div className="flex-1 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div>
                        <div className="font-medium">{slice.destination?.name}</div>
                        <div className="text-sm text-gray-500">
                          {slice.destination?.iata_code} • {slice.destination?.city_name}
                        </div>
                      </div>
                      <MapPin className="h-4 w-4 text-gray-500" />
                    </div>
                  </div>
                </div>

                {/* Times */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Departure</div>
                    <div className="font-medium">{formatTime(slice.departure_datetime)}</div>
                    <div className="text-sm text-gray-500">{formatDate(slice.departure_datetime)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Arrival</div>
                    <div className="font-medium">{formatTime(slice.arrival_datetime)}</div>
                    <div className="text-sm text-gray-500">{formatDate(slice.arrival_datetime)}</div>
                  </div>
                </div>

                {/* Flight Segments Details */}
                {slice.segments && slice.segments.length > 0 && (
                  <div className="pt-4 border-t">
                    <div className="text-sm font-medium mb-2">Flight Details</div>
                    {slice.segments.map((segment: any, segIndex: number) => (
                      <div key={segIndex} className="bg-gray-50 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-sm">
                            {segment.operating_carrier?.name || 'Unknown Carrier'}
                          </div>
                          {segment.aircraft?.name && (
                            <Badge variant="outline" className="text-xs">
                              {segment.aircraft.name}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-500">From</div>
                            <div>{segment.origin?.iata_code} • {segment.origin?.name}</div>
                          </div>
                          <div>
                            <div className="text-gray-500">To</div>
                            <div>{segment.destination?.iata_code} • {segment.destination?.name}</div>
                          </div>
                        </div>
                        {segment.duration && (
                          <div className="mt-2 text-sm text-gray-500">
                            Duration: {formatDuration(segment.duration)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Additional Information - Only show if there's actual data */}
          {(flightData.passengers || flightData.expires_at || flightData.created_at) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {flightData.passengers && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {flightData.passengers.length} passenger{flightData.passengers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {flightData.expires_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      Offer expires: {formatDate(flightData.expires_at)}
                    </span>
                  </div>
                )}

                {flightData.created_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      Created: {formatDate(flightData.created_at)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 