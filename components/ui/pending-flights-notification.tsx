'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plane, Mail, Settings } from 'lucide-react';
import { PendingFlightsModal } from './pending-flights-modal';
import { EmailSetupGuide } from './email-setup-guide';

export function PendingFlightsNotification() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingCount();
    
    // Poll for new pending flights every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchPendingCount = async () => {
    try {
      const response = await fetch('/api/pending-flights');
      if (response.ok) {
        const data = await response.json();
        const pendingFlights = data.pendingFlights.filter(
          (flight: any) => flight.status === 'PENDING_REVIEW'
        );
        setPendingCount(pendingFlights.length);
      }
    } catch (error) {
      console.error('Error fetching pending count:', error);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {pendingCount > 0 ? (
          <Button
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="relative bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Pending Flights
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {pendingCount}
            </Badge>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSetupOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Set up email forwarding
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSetupOpen(true)}
          className="text-gray-400 hover:text-gray-600"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <PendingFlightsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchPendingCount(); // Refresh count when modal closes
        }}
      />

      <EmailSetupGuide
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
      />
    </>
  );
}
