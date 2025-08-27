"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Timeline,
    TimelineContent,
    TimelineDate,
    TimelineHeader,
    TimelineIndicator,
    TimelineItem,
    TimelineSeparator,
    TimelineTitle,
} from "@/components/ui/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
    Plane,
    Hotel,
    Calendar,
    MapPin,
    Clock,
    Settings,
    RefreshCw,
    Heart,
    Coffee,
    Car,
    Utensils,
    MapPinned,
    Bookmark,
    Edit,
    X,
    Check,
    ChevronRight,
    ChevronDown,
    Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlightDetailsModal } from "@/components/ui/flight-details-modal";

// Type definitions based on our schema
type TimelineItemType = "FLIGHT" | "STAY" | "ACTIVITY" | "DINING" | "TRANSPORT" | "FREE_TIME" | "LOCATION_CHANGE" | "CHECKPOINT" | "CUSTOM";
type TimelineItemStatus = "PLANNED" | "BOOKED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ALTERNATIVE";
type LocationType = "AIRPORT" | "CITY" | "HOTEL" | "ATTRACTION" | "RESTAURANT" | "TRANSPORT_HUB" | "CUSTOM";

interface TimelineLocation {
    id: string;
    name: string;
    city?: string;
    country?: string;
    iataCode?: string;
    latitude?: number;
    longitude?: number;
    type: LocationType;
    description?: string;
    timezone?: string;
    color?: string;
    icon?: string;
}

interface TimelineAlternative {
    id: string;
    title: string;
    description?: string;
    type: TimelineItemType;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    flightData?: Record<string, unknown>;
    stayData?: Record<string, unknown>;
    activityData?: Record<string, unknown>;
    price?: number;
    currency?: string;
    reason?: string;
    score?: number;
}

interface TimelineItemData {
    id: string;
    title: string;
    description?: string;
    type: TimelineItemType;
    status: TimelineItemStatus;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    locationId?: string;
    order: number;
    level: number;
    flightData?: Record<string, unknown>;
    stayData?: Record<string, unknown>;
    activityData?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    mood?: string;
    isLocked: boolean;
    isAlternative: boolean;
    location?: TimelineLocation;
    alternatives?: TimelineAlternative[];
    children?: TimelineItemData[];
}

export interface TimelineData {
    id: string;
    title?: string;
    description?: string;
    mood?: string;
    items: TimelineItemData[];
    locations: TimelineLocation[];
}

interface MainTimelineProps {
    timeline?: TimelineData | null;
    tripId?: string;
    editable?: boolean;
    onUpdate?: (timeline: TimelineData) => void;
    onCreateItem?: (item: Partial<TimelineItemData>) => void;
    onUpdateItem?: (itemId: string, updates: Partial<TimelineItemData>) => void;
    onDeleteItem?: (itemId: string) => void;
    onSelectAlternative?: (itemId: string, alternativeId: string) => void;
    onChangeMood?: (mood: string) => void;
    onItemAdded?: () => void;
}

// Icon mapping for different item types
const typeIconMap = {
    FLIGHT: Plane,
    STAY: Hotel,
    ACTIVITY: MapPin,
    DINING: Utensils,
    TRANSPORT: Car,
    FREE_TIME: Coffee,
    LOCATION_CHANGE: MapPinned,
    CHECKPOINT: Bookmark,
    CUSTOM: Settings,
};

// Color mapping for different item types
const typeColorMap = {
    FLIGHT: "bg-blue-100 text-blue-800 border-blue-200",
    STAY: "bg-green-100 text-green-800 border-green-200",
    ACTIVITY: "bg-purple-100 text-purple-800 border-purple-200",
    DINING: "bg-orange-100 text-orange-800 border-orange-200",
    TRANSPORT: "bg-yellow-100 text-yellow-800 border-yellow-200",
    FREE_TIME: "bg-gray-100 text-gray-800 border-gray-200",
    LOCATION_CHANGE: "bg-indigo-100 text-indigo-800 border-indigo-200",
    CHECKPOINT: "bg-pink-100 text-pink-800 border-pink-200",
    CUSTOM: "bg-slate-100 text-slate-800 border-slate-200",
};

// Status color mapping
const statusColorMap = {
    PLANNED: "bg-gray-100 text-gray-700",
    BOOKED: "bg-blue-100 text-blue-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    ALTERNATIVE: "bg-purple-100 text-purple-700",
};

function formatTime(date: Date | string): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
function formatDate(date: Date | string): string {
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
}

function TimelineItemComponent({
    item,
    editable,
    onUpdate,
    onDelete,
    onSelectAlternative,
    level = 0
}: {
    item: TimelineItemData;
    editable?: boolean;
    onUpdate?: (updates: Partial<TimelineItemData>) => void;
    onDelete?: () => void;
    onSelectAlternative?: (alternativeId: string) => void;
    level?: number;
}) {
    const [isExpanded, setIsExpanded] = useState(level < 2);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showFlightDetails, setShowFlightDetails] = useState(false);
    const [isActionsHover, setIsActionsHover] = useState(false);

    // DEBUG: Log individual item details (only to console, not in render)
    useEffect(() => {
        console.log(`🔍 TIMELINE-ITEM DEBUG - Rendering item:`, {
            id: item.id,
            type: item.type,
            title: item.title,
            level: level,
            hasFlightData: !!item.flightData,
            hasChildren: !!(item.children && item.children.length > 0),
            source: 'INDIVIDUAL_ITEM_RENDER'
        });
    }, [item.id, item.type, item.title, level, item.flightData, item.children]);

    const Icon = typeIconMap[item.type];
    const hasChildren = item.children && item.children.length > 0;
    const isRoundTripGroup = item.type === "LOCATION_CHANGE" && hasChildren && item.children!.filter(c => c.type === "FLIGHT").length >= 2;
    const hasAlternatives = item.alternatives && item.alternatives.length > 0;

    return (
        <TimelineItem key={item.id} step={item.order}>
            <TimelineHeader>
                <TimelineSeparator />
                <TimelineDate>
                    {formatDate(item.startTime)}
                    {item.startTime && <div className="text-xs">{formatTime(item.startTime)}</div>}
                </TimelineDate>
                <div className="flex-1 min-w-0">
                    <Card 
                        className={cn(
                            "shadow-sm transition-all duration-200 group/card mr-3",
                            level > 0 && "bg-gray-50/50",
                            item.type === "FLIGHT" && item.flightData && (
                                !isActionsHover ? "cursor-pointer hover:shadow-md hover:bg-gray-100/10" : "cursor-pointer"
                            )
                        )}
                        onClick={() => {
                            if (item.type === "FLIGHT" && item.flightData) {
                                setShowFlightDetails(true);
                            }
                        }}
                    >
                        <CardHeader className={cn("pb-2 px-4 py-3", isRoundTripGroup && "border-l-2 border-dashed border-blue-300") }>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {hasChildren && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsExpanded(!isExpanded)}
                                            className="h-6 w-6 p-0"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-gray-600" />
                                        <Badge
                                            variant="outline"
                                            className={cn("text-xs px-2 py-0.5", typeColorMap[item.type])}
                                        >
                                            {item.type.toLowerCase()}
                                        </Badge>
                                    </div>
                                    <TimelineTitle className="truncate">{item.title}{isRoundTripGroup && <span className="ml-2 text-xs text-gray-500">(round trip)</span>}</TimelineTitle>
                                    <Badge
                                        variant="outline"
                                        className={cn("text-xs px-2 py-0.5 ml-auto", statusColorMap[item.status])}
                                    >
                                        {item.status.toLowerCase()}
                                    </Badge>
                                </div>
                                {editable && (
                                    <div
                                      className="flex items-center gap-1 ml-2 group/actions"
                                      onMouseEnter={() => setIsActionsHover(true)}
                                      onMouseLeave={() => setIsActionsHover(false)}
                                    >
                                        {!item.isLocked && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                                                className="h-6 w-6 p-0 text-red-500 relative z-10"
                                                aria-label="Delete item"
                                                title="Delete item"
                                            >
                                                <X className="h-3 w-3 pointer-events-none" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        {(item.description || item.location || item.duration) && (
                            <CardContent className="pt-0 px-4 pb-3">
                                <TimelineContent className="space-y-2">
                                    {item.description && (
                                        <p className="text-xs text-gray-600">{item.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        {item.location && (
                                            <div className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                <span>{item.location.name}</span>
                                            </div>
                                        )}
                                        {item.duration && (
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span>{formatDuration(item.duration)}</span>
                                            </div>
                                        )}
                                        {item.mood && (
                                            <div className="flex items-center gap-1">
                                                <Heart className="h-3 w-3" />
                                                <span>{item.mood}</span>
                                            </div>
                                        )}
                                    </div>
                                </TimelineContent>
                            </CardContent>
                        )}
                    </Card>
                </div>
                <TimelineIndicator>
                    {item.isLocked && <Check className="h-2 w-2" />}
                </TimelineIndicator>
            </TimelineHeader>

            {/* Alternatives */}
            {showAlternatives && hasAlternatives && (
                <div className="ml-8 mt-2 space-y-2">
                    <div className="text-sm font-medium text-gray-700">Alternatives:</div>
                    {item.alternatives!.map((alt) => (
                        <Card key={alt.id} className="bg-blue-50 border-blue-200">
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{alt.title}</div>
                                        {alt.description && (
                                            <div className="text-xs text-gray-600">{alt.description}</div>
                                        )}
                                        {alt.price && (
                                            <div className="text-xs font-medium text-green-600">
                                                {alt.currency}{alt.price}
                                            </div>
                                        )}
                                    </div>
                                    {editable && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onSelectAlternative?.(alt.id)}
                                        >
                                            Select
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Children */}
            {isExpanded && hasChildren && (
                <div className={cn("ml-6 mt-2 space-y-2", isRoundTripGroup && "relative") }>
                    {isRoundTripGroup && (
                        <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-blue-300/60 to-blue-300/0" />
                    )}
                    {item.children!.map((child) => (
                        <TimelineItemComponent
                            key={child.id}
                            item={child}
                            editable={editable}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onSelectAlternative={onSelectAlternative}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}

            {/* Flight Details Modal */}
            {item.type === "FLIGHT" && item.flightData && (
                <FlightDetailsModal
                    isOpen={showFlightDetails}
                    onClose={() => setShowFlightDetails(false)}
                    flightData={item.flightData}
                    itemTitle={item.title}
                />
            )}
        </TimelineItem>
    );
}

export default function MainTimeline({
    timeline: propTimeline,
    editable = false,
    onCreateItem,
    onUpdateItem,
    onDeleteItem,
    onSelectAlternative,
    onChangeMood,
    tripId,
    onItemAdded,
}: MainTimelineProps) {
    // HYDRATION-SAFE: Use useEffect for all console logging
    const [isClient, setIsClient] = useState(false);
    const router = useRouter();
    
    useEffect(() => {
        setIsClient(true);
        
        // All debug logging moved to useEffect (client-only)
        console.log(`\n🔍 MAIN-TIMELINE DEBUG - Component mount`);
        console.log(`🔍 Timestamp:`, new Date().toISOString());
        console.log(`🔍 Props timeline:`, !!propTimeline);
        console.log(`🔍 Timeline items count:`, propTimeline?.items?.length || 0);
    }, [propTimeline]);

    // SIMPLIFIED: Just use props timeline (no context)
    const timeline = propTimeline;

    const [selectedMood, setSelectedMood] = useState(timeline?.mood || "");

    // Manual refresh function for debugging
    const handleManualRefresh = async () => {
        console.log(`🔍 Manual refresh triggered - reloading page`);
        window.location.reload();
    };

    // Example: Call router.refresh() after adding a new item
    const handleItemAdded = () => {
        if (onItemAdded) {
            onItemAdded();
        } else {
            router.refresh();
        }
    };

    if (!timeline) {
        return (
            <div className="space-y-4">
                {/* Empty State */}
                <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                        <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-lg font-medium">No timeline created yet</p>
                        <p className="text-sm">Create your first timeline to start planning your trip</p>
                    </div>
                </div>
            </div>
        );
    }

    // Group items by hierarchy (top-level items first) and sort by start time
    const topLevelItems = (timeline.items || [])
        .filter((item: TimelineItemData) => item.level === 0)
        .sort((a: TimelineItemData, b: TimelineItemData) => {
            // Sort by start time first
            const timeComparison = a.startTime.getTime() - b.startTime.getTime();
            if (timeComparison !== 0) return timeComparison;
            // If times are equal, fall back to order
            return a.order - b.order;
        });

    const handleItemUpdate = (itemId: string, updates: Partial<TimelineItemData>) => {
        if (isClient) {
            console.log(`🔍 Item update requested:`, { itemId, updates });
        }
        onUpdateItem?.(itemId, updates);
    };

    const handleItemDelete = (itemId: string) => {
        if (isClient) {
            console.log(`🔍 Item delete requested:`, itemId);
        }
        onDeleteItem?.(itemId);
    };

    const handleAlternativeSelect = (itemId: string, alternativeId: string) => {
        if (isClient) {
            console.log(`🔍 Alternative select requested:`, { itemId, alternativeId });
        }
        onSelectAlternative?.(itemId, alternativeId);
    };

    const handleMoodChange = (mood: string) => {
        if (isClient) {
            console.log(`🔍 Mood change requested:`, mood);
        }
        setSelectedMood(mood);
        onChangeMood?.(mood);
    };

    return (
        <div className="space-y-6">


            {/* Timeline Header */}
            <div className="flex items-center justify-between mt-4">
                <div>
                    <h2 className="text-2xl font-bold">
                        {timeline.title || "Trip Timeline"}
                    </h2>
                    {timeline.description && (
                        <p className="text-gray-600 mt-1">{timeline.description}</p>
                    )}
                </div>
            </div>

            {/* Timeline Content */}
            <Timeline defaultValue={1} className="relative space-y-2 px-2">
                {topLevelItems.map((item: TimelineItemData) => (
                    <TimelineItemComponent
                        key={item.id}
                        item={item}
                        editable={editable}
                        onUpdate={(updates) => handleItemUpdate(item.id, updates)}
                        onDelete={() => handleItemDelete(item.id)}
                        onSelectAlternative={(altId) => handleAlternativeSelect(item.id, altId)}
                        level={0}
                    />
                ))}
            </Timeline>

            {/* Empty State */}
            {topLevelItems.length === 0 && (
                <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600">Timeline is empty</p>
                    <p className="text-sm text-gray-500 mb-4">
                        Start building your itinerary by adding flights, hotels, and activities
                    </p>
                    {editable && (
                        <Button onClick={() => {
                            if (onCreateItem) {
                                onCreateItem({});
                                handleItemAdded();
                            } else {
                                handleItemAdded();
                            }
                         }}>
                            <Plus className="h-4 w-4 mr-1" />
                            Create First Item
                        </Button>
                    )}
                </div>
            )}

            {/* HYDRATION SAFE: No dynamic timestamps in render */}
            <div className="text-xs text-gray-400 mt-8">
                Debug: main-timeline | Status: {isClient ? 'Client Ready' : 'Server Rendered'}
            </div>
        </div>
    )
}