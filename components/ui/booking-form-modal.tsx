"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, User, Mail, Phone, Calendar, Loader2 } from "lucide-react";

interface PassengerInfo {
  given_name: string;
  family_name: string;
  email: string;
  phone_number: string;
  born_on: string;
  title: string;
  gender: string;
}

interface PaymentInfo {
  card_number: string;
  expiry_month: string;
  expiry_year: string;
  cvv: string;
  cardholder_name: string;
}

interface BookingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (passengerInfo: PassengerInfo, paymentInfo: PaymentInfo) => Promise<void>;
  isBooking: boolean;
  isBookingAll?: boolean;
  itemCount?: number;
}

export function BookingFormModal({
  isOpen,
  onClose,
  onSubmit,
  isBooking,
  isBookingAll = false,
  itemCount = 1,
}: BookingFormModalProps) {
  const [passengerInfo, setPassengerInfo] = useState<PassengerInfo>({
    given_name: "",
    family_name: "",
    email: "",
    phone_number: "",
    born_on: "",
    title: "mr",
    gender: "m",
  });

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    card_number: "",
    expiry_month: "",
    expiry_year: "",
    cvv: "",
    cardholder_name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(passengerInfo, paymentInfo);
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

  const formatExpiry = (value: string): string => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            {isBookingAll ? `Book All Flights (${itemCount})` : "Book Flight"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                    value={passengerInfo.title}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPassengerInfo(prev => ({ ...prev, title: e.target.value }))}
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
                    value={passengerInfo.gender}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPassengerInfo(prev => ({ ...prev, gender: e.target.value }))}
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
                    value={passengerInfo.given_name}
                    onChange={(e) => setPassengerInfo(prev => ({ ...prev, given_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="family_name">Last Name</Label>
                  <Input
                    id="family_name"
                    value={passengerInfo.family_name}
                    onChange={(e) => setPassengerInfo(prev => ({ ...prev, family_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={passengerInfo.email}
                  onChange={(e) => setPassengerInfo(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="+1234567890"
                  value={passengerInfo.phone_number}
                  onChange={(e) => setPassengerInfo(prev => ({ ...prev, phone_number: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="born_on">Date of Birth</Label>
                <Input
                  id="born_on"
                  type="date"
                  value={passengerInfo.born_on}
                  onChange={(e) => setPassengerInfo(prev => ({ ...prev, born_on: e.target.value }))}
                  required
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
                  value={paymentInfo.cardholder_name}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, cardholder_name: e.target.value }))}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <Label htmlFor="card_number">Card Number</Label>
                <Input
                  id="card_number"
                  value={paymentInfo.card_number}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, card_number: formatCardNumber(e.target.value) }))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="expiry_month">Expiry Month</Label>
                  <Input
                    id="expiry_month"
                    value={paymentInfo.expiry_month}
                    onChange={(e) => setPaymentInfo(prev => ({ ...prev, expiry_month: e.target.value }))}
                    placeholder="MM"
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expiry_year">Expiry Year</Label>
                  <Input
                    id="expiry_year"
                    value={paymentInfo.expiry_year}
                    onChange={(e) => setPaymentInfo(prev => ({ ...prev, expiry_year: e.target.value }))}
                    placeholder="YY"
                    maxLength={2}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    value={paymentInfo.cvv}
                    onChange={(e) => setPaymentInfo(prev => ({ ...prev, cvv: e.target.value }))}
                    placeholder="123"
                    maxLength={4}
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isBooking}>
              Cancel
            </Button>
            <Button type="submit" disabled={isBooking} className="bg-blue-600 hover:bg-blue-700">
              {isBooking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isBookingAll ? `Book All (${itemCount})` : "Book Flight"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 