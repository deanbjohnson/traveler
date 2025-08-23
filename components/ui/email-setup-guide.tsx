'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Copy, Check, ExternalLink } from 'lucide-react';
import { useUser } from '@clerk/nextjs';

interface EmailSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailSetupGuide({ isOpen, onClose }: EmailSetupGuideProps) {
  const { user } = useUser();
  const [copied, setCopied] = useState(false);
  
  // Generate a unique email address for the user
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const inboundEmail = userEmail ? 
    `flights.${userEmail.split('@')[0]}@inbound.new` : 
    'your-email@inbound.new';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const steps = [
    {
      number: 1,
      title: 'Get Your Inbound Email',
      description: 'We\'ve created a unique email address for you to forward booking emails to.',
      action: (
        <div className="flex items-center gap-2">
          <code className="bg-gray-100 px-3 py-2 rounded text-sm font-mono">
            {inboundEmail}
          </code>
          <Button
            size="sm"
            variant="outline"
            onClick={copyToClipboard}
            className="flex items-center gap-1"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      )
    },
    {
      number: 2,
      title: 'Forward Your Booking Emails',
      description: 'When you receive flight confirmation emails from airlines, forward them to your Inbound email address.',
      action: (
        <div className="text-sm text-gray-600">
          <p>• Forward emails from: JetBlue, American Airlines, Delta, United, etc.</p>
          <p>• Include: Flight confirmations, booking receipts, itinerary emails</p>
        </div>
      )
    },
    {
      number: 3,
      title: 'Review & Assign Flights',
      description: 'Check back here to see your parsed flights and assign them to your trips.',
      action: (
        <div className="text-sm text-gray-600">
          <p>• Flights will appear in the "Pending Flights" notification</p>
          <p>• Click to review and assign to your trips</p>
        </div>
      )
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Set Up Email Forwarding
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
            <p className="text-sm text-blue-700">
              Forward your flight booking emails to your unique Inbound.new address, and we'll automatically parse the flight details and add them to your timeline.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((step) => (
              <Card key={step.number}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-8 w-8 rounded-full p-0 flex items-center justify-center">
                      {step.number}
                    </Badge>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-3">{step.description}</p>
                  {step.action}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Supported Airlines</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>• JetBlue</div>
              <div>• American Airlines</div>
              <div>• Delta Air Lines</div>
              <div>• United Airlines</div>
              <div>• Southwest Airlines</div>
              <div>• Alaska Airlines</div>
              <div>• Spirit Airlines</div>
              <div>• And many more...</div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Got it
            </Button>
            <Button asChild>
              <a href="https://inbound.new" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Learn More About Inbound.new
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
