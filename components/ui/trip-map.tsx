"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, Hotel, MapPin, Clock, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAirportCoordinates, ensureAirportsLoaded } from "@/lib/geocoding";

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface TimelineItemData {
  id: string;
  title: string;
  description?: string;
  type: "FLIGHT" | "STAY" | "ACTIVITY" | "DINING" | "TRANSPORT" | "FREE_TIME" | "LOCATION_CHANGE" | "CHECKPOINT" | "CUSTOM";
  startTime: Date;
  endTime?: Date;
  duration?: number;
  flightData?: Record<string, unknown>;
  stayData?: Record<string, unknown>;
  location?: {
    name: string;
    city?: string;
    country?: string;
    iataCode?: string;
    latitude?: number;
    longitude?: number;
  };
}

interface TripMapProps {
  timeline: {
    id: string;
    title?: string;
    items: TimelineItemData[];
  };
  className?: string;
}

// Icon mapping for different item types
const typeIconMap = {
  FLIGHT: Plane,
  STAY: Hotel,
  ACTIVITY: MapPin,
  DINING: MapPin,
  TRANSPORT: Navigation,
  FREE_TIME: MapPin,
  LOCATION_CHANGE: MapPin,
  CHECKPOINT: MapPin,
  CUSTOM: MapPin,
};

// Color mapping for different item types
const typeColorMap = {
  FLIGHT: "bg-blue-500",
  STAY: "bg-green-500",
  ACTIVITY: "bg-purple-500",
  DINING: "bg-orange-500",
  TRANSPORT: "bg-yellow-500",
  FREE_TIME: "bg-gray-500",
  LOCATION_CHANGE: "bg-indigo-500",
  CHECKPOINT: "bg-pink-500",
  CUSTOM: "bg-slate-500",
};

export function TripMap({ timeline, className }: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedItem, setSelectedItem] = useState<TimelineItemData | null>(null);
  const [hoveredItem, setHoveredItem] = useState<TimelineItemData | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const routesRef = useRef<Map<string, any>>(new Map());

  // Extract coordinates and routes from timeline items
  const extractCoordinatesAndRoutes = (items: TimelineItemData[]) => {
    const coordinates: Array<{
      item: TimelineItemData;
      coordinates: [number, number];
      type: string;
    }> = [];

    const routes: Array<{
      item: TimelineItemData;
      coordinates: [number, number][];
      originCode: string;
      destCode: string;
    }> = [];

    items.forEach((item) => {
      // For flights, extract from flightData using airport codes
      if (item.type === "FLIGHT" && item.flightData) {
        const flightData = item.flightData as any;
        if (flightData.slices && flightData.slices.length > 0) {
          // Add origin
          const origin = flightData.slices[0].origin;
          if (origin && origin.iata_code) {
            const originCoords = getAirportCoordinates(origin.iata_code);
            if (originCoords) {
              coordinates.push({
                item,
                coordinates: [originCoords.lng, originCoords.lat],
                type: "origin",
              });
            }
          }

          // Add destination
          const destination = flightData.slices[0].destination;
          if (destination && destination.iata_code) {
            const destCoords = getAirportCoordinates(destination.iata_code);
            if (destCoords) {
              coordinates.push({
                item,
                coordinates: [destCoords.lng, destCoords.lat],
                type: "destination",
              });
            }
          }

          // Add route
          if (origin?.iata_code && destination?.iata_code) {
            const originCoords = getAirportCoordinates(origin.iata_code);
            const destCoords = getAirportCoordinates(destination.iata_code);
            if (originCoords && destCoords) {
              routes.push({
                item,
                coordinates: [
                  [originCoords.lng, originCoords.lat],
                  [destCoords.lng, destCoords.lat]
                ],
                originCode: origin.iata_code,
                destCode: destination.iata_code,
              });
            }
          }
        }
      }

      // For stays and other items with location data
      if (item.location && item.location.latitude && item.location.longitude) {
        coordinates.push({
          item,
          coordinates: [item.location.longitude, item.location.latitude],
          type: "location",
        });
      }
    });

    return { coordinates, routes };
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128], // Default to NYC
      zoom: 10,
    });

    map.current.on("load", () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded || !timeline?.items?.length) return;

    // Clear existing markers and routes
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    routesRef.current.clear();

    // Ensure extended airport DB is available before extracting
    (async () => {
      await ensureAirportsLoaded();
      const { coordinates, routes } = extractCoordinatesAndRoutes(timeline.items || []);

      if (coordinates.length === 0) {
        console.log("No coordinates found in timeline items");
        return;
      }

    // Calculate bounds
    const bounds = new mapboxgl.LngLatBounds();
    coordinates.forEach(({ coordinates: coords }) => {
      bounds.extend(coords);
    });

      // Fit map to bounds
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      });

      // Add routes first (so they appear behind markers)
      routes.forEach((route, index) => {
      const routeId = `route-${route.item.id}`;
      
      // Add route source
      map.current!.addSource(routeId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route.coordinates,
          },
        },
      });

      // Add route layer
      map.current!.addLayer({
        id: routeId,
        type: "line",
        source: routeId,
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#3b82f6",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });

        routesRef.current.set(route.item.id, { routeId, sourceId: routeId });
      });

      // Add markers for each coordinate
      coordinates.forEach(({ item, coordinates: coords, type }) => {
      // Create marker element
      const markerEl = document.createElement("div");
      markerEl.className = "marker";
      markerEl.style.width = "20px";
      markerEl.style.height = "20px";
      markerEl.style.borderRadius = "50%";
      
      // Convert Tailwind class to actual color
      const colorMap: Record<string, string> = {
        "bg-blue-500": "#3b82f6",
        "bg-green-500": "#10b981",
        "bg-purple-500": "#8b5cf6",
        "bg-orange-500": "#f97316",
        "bg-yellow-500": "#eab308",
        "bg-gray-500": "#6b7280",
        "bg-indigo-500": "#6366f1",
        "bg-pink-500": "#ec4899",
        "bg-slate-500": "#64748b",
      };
      markerEl.style.backgroundColor = colorMap[typeColorMap[item.type]] || "#6b7280";
      markerEl.style.border = "2px solid white";
      markerEl.style.cursor = "pointer";
      markerEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      markerEl.style.transition = "all 0.2s ease";

      // Add marker to map
      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat(coords)
        .addTo(map.current!);

      // Store marker reference
      markersRef.current.set(`${item.id}-${type}`, marker);

      // Add popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-2">
          <h3 class="font-semibold text-sm">${item.title}</h3>
          <p class="text-xs text-gray-600">${item.type} ${type === "origin" ? "(Origin)" : type === "destination" ? "(Destination)" : ""}</p>
          <p class="text-xs text-gray-600">${new Date(item.startTime).toLocaleDateString()}</p>
          ${type === "origin" || type === "destination" ? `<p class="text-xs text-gray-500">${(() => {
            const flightData = item.flightData as any;
            const slice = flightData?.slices?.[0];
            const airport = type === "origin" ? slice?.origin : slice?.destination;
            return getAirportCoordinates(airport?.iata_code)?.name || "Unknown Airport";
          })()}</p>` : ""}
        </div>
      `);

        marker.setPopup(popup);

      // Add click handler
        markerEl.addEventListener("click", () => {
        if (selectedItem?.id === item.id) {
          // If clicking the same item, deselect it
          setSelectedItem(null);
        } else {
          // Otherwise, select the new item
          setSelectedItem(item);
        }
      });

      // Add hover handlers
        markerEl.addEventListener("mouseenter", () => {
        setHoveredItem(item);
      });

        markerEl.addEventListener("mouseleave", () => {
          setHoveredItem(null);
        });
      });
    })();
  }, [mapLoaded, timeline.items]);

  // Effect to handle highlighting on hover/selection
  useEffect(() => {
    if (!map.current) return;

    const activeItem = hoveredItem || selectedItem;

    // Reset all markers and routes to default appearance
    markersRef.current.forEach((marker, key) => {
      const markerEl = marker.getElement();
      if (markerEl) {
        markerEl.style.transform = "scale(1)";
        markerEl.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
      }
    });

    // Reset all routes to default appearance
    routesRef.current.forEach((routeInfo) => {
      if (map.current!.getLayer(routeInfo.routeId)) {
        map.current!.setPaintProperty(routeInfo.routeId, "line-color", "#3b82f6");
        map.current!.setPaintProperty(routeInfo.routeId, "line-width", 3);
      }
    });

    // Highlight active item if any
    if (activeItem) {
      // Highlight markers for this item
      markersRef.current.forEach((marker, key) => {
        if (key.startsWith(activeItem.id)) {
          const markerEl = marker.getElement();
          if (markerEl) {
            markerEl.style.transform = "scale(1.3)";
            markerEl.style.boxShadow = "0 4px 8px rgba(0,0,0,0.5)";
          }
        }
      });

      // Highlight route for this item
      const routeInfo = routesRef.current.get(activeItem.id);
      if (routeInfo && map.current!.getLayer(routeInfo.routeId)) {
        map.current!.setPaintProperty(routeInfo.routeId, "line-color", "#f59e0b");
        map.current!.setPaintProperty(routeInfo.routeId, "line-width", 5);
      }
    }
  }, [hoveredItem, selectedItem]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Map Container */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Trip Map
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={mapContainer}
            className="w-full h-96 rounded-lg overflow-hidden border border-gray-200"
          />
        </CardContent>
      </Card>

      {/* Selected Item Details */}
      {selectedItem && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = typeIconMap[selectedItem.type];
                return <Icon className="h-5 w-5" />;
              })()}
              {selectedItem.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={typeColorMap[selectedItem.type]}>
                {selectedItem.type.toLowerCase()}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                {formatDate(selectedItem.startTime)} at {formatTime(selectedItem.startTime)}
              </div>
            </div>
            
            {selectedItem.description && (
              <p className="text-sm text-gray-600">{selectedItem.description}</p>
            )}

            {selectedItem.location && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                {selectedItem.location.name}
                {selectedItem.location.city && `, ${selectedItem.location.city}`}
                {selectedItem.location.country && `, ${selectedItem.location.country}`}
              </div>
            )}

            {selectedItem.duration && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Clock className="h-4 w-4" />
                Duration: {Math.floor(selectedItem.duration / 60)}h {selectedItem.duration % 60}m
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {timeline?.items?.length > 0 ? (
              (timeline.items || []).map((item) => {
                const Icon = typeIconMap[item.type];
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedItem?.id === item.id 
                        ? "bg-blue-100 border border-blue-300 text-gray-900" 
                        : hoveredItem?.id === item.id 
                        ? "bg-gray-100 border border-gray-300 text-gray-900" 
                        : "hover:bg-gray-50"
                    }`}
                    onClick={() => {
                      if (selectedItem?.id === item.id) {
                        // If clicking the same item, deselect it
                        setSelectedItem(null);
                      } else {
                        // Otherwise, select the new item
                        setSelectedItem(item);
                      }
                    }}
                    onMouseEnter={() => setHoveredItem(item)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    <div className={cn("p-2 rounded-full", typeColorMap[item.type])}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm truncate ${
                        selectedItem?.id === item.id || hoveredItem?.id === item.id ? "text-gray-900" : ""
                      }`}>{item.title}</p>
                      <p className={`text-xs ${
                        selectedItem?.id === item.id ? "text-gray-700" : 
                        hoveredItem?.id === item.id ? "text-gray-700" : "text-gray-600"
                      }`}>
                        {formatDate(item.startTime)} at {formatTime(item.startTime)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.type.toLowerCase()}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-500 py-4">
                No timeline items to display on map
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 