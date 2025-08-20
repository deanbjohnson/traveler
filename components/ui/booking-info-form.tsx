"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, CreditCard, Save, CheckCircle, AlertCircle } from "lucide-react";

interface BookingInfo {
  passenger: {
    given_name: string;
    family_name: string;
    email: string;
    phone_number: string;
    born_on: string;
    title: string;
    gender: string;
  };
  payment: {
    card_number: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
    cardholder_name: string;
  };
}

interface BookingInfoFormProps {
  userId: string;
}

export function BookingInfoForm({ userId }: BookingInfoFormProps) {
  const [bookingInfo, setBookingInfo] = useState<BookingInfo>({
    passenger: {
      given_name: "",
      family_name: "",
      email: "",
      phone_number: "",
      born_on: "",
      title: "mr",
      gender: "m",
    },
    payment: {
      card_number: "",
      expiry_month: "",
      expiry_year: "",
      cvv: "",
      cardholder_name: "",
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved booking info on component mount
  useEffect(() => {
    loadBookingInfo();
  }, [userId]);

  const loadBookingInfo = async () => {
    try {
      // TODO: Implement API call to load saved booking info
      // const response = await fetch(`/api/booking-info/${userId}`);
      // if (response.ok) {
      //   const data = await response.json();
      //   setBookingInfo(data);
      // }
    } catch (error) {
      console.error("Failed to load booking info:", error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // TODO: Implement API call to save booking info
      // const response = await fetch(`/api/booking-info/${userId}`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(bookingInfo),
      // });
      
      // if (response.ok) {
      //   setIsSaved(true);
      //   setTimeout(() => setIsSaved(false), 3000);
      // } else {
      //   throw new Error("Failed to save booking info");
      // }
      
      // For now, just simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      
    } catch (error) {
      setError("Failed to save booking information. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCardNumber = (value: string): string => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  return (
    <div className="space-y-6">
      {/* Passenger Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-4 w-4" />
            Passenger Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Select
                value={bookingInfo.passenger.title}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    passenger: { ...prev.passenger, title: e.target.value }
                  }))
                }
              >
                <option value="mr">Mr.</option>
                <option value="mrs">Mrs.</option>
                <option value="ms">Ms.</option>
                <option value="miss">Miss</option>
                <option value="dr">Dr.</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={bookingInfo.passenger.gender}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    passenger: { ...prev.passenger, gender: e.target.value }
                  }))
                }
              >
                <option value="m">Male</option>
                <option value="f">Female</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="given_name">First Name</Label>
              <Input
                id="given_name"
                value={bookingInfo.passenger.given_name}
                onChange={(e) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    passenger: { ...prev.passenger, given_name: e.target.value }
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="family_name">Last Name</Label>
              <Input
                id="family_name"
                value={bookingInfo.passenger.family_name}
                onChange={(e) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    passenger: { ...prev.passenger, family_name: e.target.value }
                  }))
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={bookingInfo.passenger.email}
              onChange={(e) => 
                setBookingInfo(prev => ({
                  ...prev,
                  passenger: { ...prev.passenger, email: e.target.value }
                }))
              }
            />
          </div>

          <div>
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              type="tel"
              placeholder="+1234567890"
              value={bookingInfo.passenger.phone_number}
              onChange={(e) => 
                setBookingInfo(prev => ({
                  ...prev,
                  passenger: { ...prev.passenger, phone_number: e.target.value }
                }))
              }
            />
          </div>

          <div>
            <Label htmlFor="born_on">Date of Birth</Label>
            <Input
              id="born_on"
              type="date"
              value={bookingInfo.passenger.born_on}
              onChange={(e) => 
                setBookingInfo(prev => ({
                  ...prev,
                  passenger: { ...prev.passenger, born_on: e.target.value }
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-4 w-4" />
            Payment Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cardholder_name">Cardholder Name</Label>
            <Input
              id="cardholder_name"
              value={bookingInfo.payment.cardholder_name}
              onChange={(e) => 
                setBookingInfo(prev => ({
                  ...prev,
                  payment: { ...prev.payment, cardholder_name: e.target.value }
                }))
              }
              placeholder="John Doe"
            />
          </div>

          <div>
            <Label htmlFor="card_number">Card Number</Label>
            <Input
              id="card_number"
              value={bookingInfo.payment.card_number}
              onChange={(e) => 
                setBookingInfo(prev => ({
                  ...prev,
                  payment: { ...prev.payment, card_number: formatCardNumber(e.target.value) }
                }))
              }
              placeholder="1234 5678 9012 3456"
              maxLength={19}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="expiry_month">Expiry Month</Label>
              <Input
                id="expiry_month"
                value={bookingInfo.payment.expiry_month}
                onChange={(e) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    payment: { ...prev.payment, expiry_month: e.target.value }
                  }))
                }
                placeholder="MM"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="expiry_year">Expiry Year</Label>
              <Input
                id="expiry_year"
                value={bookingInfo.payment.expiry_year}
                onChange={(e) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    payment: { ...prev.payment, expiry_year: e.target.value }
                  }))
                }
                placeholder="YY"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="cvv">CVV</Label>
              <Input
                id="cvv"
                value={bookingInfo.payment.cvv}
                onChange={(e) => 
                  setBookingInfo(prev => ({
                    ...prev,
                    payment: { ...prev.payment, cvv: e.target.value }
                  }))
                }
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button and Status */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Booking Information
            </>
          )}
        </Button>

        {isSaved && (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>Booking information saved!</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-400">
        <p>💡 <strong>Tip:</strong> Your booking information will be automatically filled in when you book flights, saving you time!</p>
      </div>
    </div>
  );
} 