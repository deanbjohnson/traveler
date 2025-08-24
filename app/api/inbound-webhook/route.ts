import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface InboundEmail {
  id: string;
  from: string | {
    text: string;
    addresses: Array<{
      name: string | null;
      address: string;
    }>;
  };
  to: string | {
    text: string;
    addresses: Array<{
      name: string | null;
      address: string;
    }>;
  };
  recipient?: string;
  subject: string;
  text?: string;
  html?: string;
  parsedData?: {
    textBody?: string;
    htmlBody?: string;
  };
  headers: Record<string, string>;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    url?: string;
  }>;
}

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('=== FULL WEBHOOK PAYLOAD ===');
    console.log(JSON.stringify(body, null, 2));
    console.log('=== END PAYLOAD ===');

    // Verify the webhook is from Inbound.new (you should add proper verification)
    const email: InboundEmail = body.email;
    
    if (!email) {
      return NextResponse.json({ error: 'No email data received' }, { status: 400 });
    }

    // Parse flight information from the email
    const flightData = parseFlightFromEmail(email);
    
    if (!flightData) {
      console.log('No flight data found in email');
      return NextResponse.json({ error: 'No flight data found' }, { status: 400 });
    }

    // Extract the sender's email address (the person who forwarded the email)
    const senderEmail = typeof email.from === 'string' ? email.from : email.from?.text || email.from?.addresses?.[0]?.address || 'unknown@example.com';
    
    // Clean up the email address (remove quotes, angle brackets, and extract just the email part)
    let cleanEmail = senderEmail.replace(/["<>]/g, '').trim();
    
    // If the email contains a name (e.g., "Dean Johnson <deanberlinjohnson@gmail.com>"), extract just the email
    const emailMatch = cleanEmail.match(/<(.+@.+)>/);
    if (emailMatch) {
      cleanEmail = emailMatch[1];
    }
    
    console.log('🔍 Looking for user with email:', cleanEmail);
    
    // First try to find user by email (this will work for users who have signed up)
    let user = await prisma.user.findFirst({
      where: {
        email: cleanEmail
      }
    });

    if (!user) {
      console.log('❌ No existing user found for email:', cleanEmail);
      console.log('Creating temporary user for email forwarding');
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: 'Flight Email User'
        }
      });
      console.log('✅ Created new user with ID:', user.id);
    } else {
      console.log('✅ Found existing user for email:', cleanEmail, 'User ID:', user.id);
    }

    // Extract email addresses from Inbound.new's structure
    const emailFromAddress = typeof email.from === 'string' ? email.from : email.from?.text || email.from?.addresses?.[0]?.address || 'unknown@example.com';
    
    // Store the parsed flight data for the user to review
    const pendingFlight = await prisma.pendingFlight.create({
      data: {
        userId: user.id,
        emailId: email.id,
        emailSubject: email.subject,
        emailFrom: emailFromAddress,
        emailDate: new Date(),
        parsedData: flightData,
        status: 'PENDING_REVIEW'
      }
    });

    console.log('Pending flight created:', pendingFlight.id);

    return NextResponse.json({ 
      success: true, 
      pendingFlightId: pendingFlight.id,
      message: 'Flight data parsed and stored for review'
    });

  } catch (error) {
    console.error('Error processing inbound webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseFlightFromEmail(email: InboundEmail): ParsedFlightData | null {
  // Handle Inbound.new's parsed data structure
  const subject = email.subject || '';
  const text = email.text || email.parsedData?.textBody || '';
  const html = email.html || email.parsedData?.htmlBody || '';
  
  // Combine text and HTML content for parsing
  const content = `${subject}\n${text}\n${html}`.toLowerCase();
  
  // Debug logging
  console.log('=== DEBUG: Email Content ===');
  console.log('Subject:', subject);
  console.log('Text:', text);
  console.log('HTML:', html);
  console.log('Combined content:', content);
  console.log('=== END DEBUG ===');
  
  // Common patterns for flight booking emails
  const patterns = {
    airline: /(?:airline|carrier|operated by|flight operated by)[:\s]*([a-zA-Z\s]+)/i,
    flightNumber: /(?:flight|flight number|flight #)[:\s]*([A-Z]{2,3}\s*\d+)/i,
    origin: /(?:from|departure|origin)[:\s]*([A-Z]{3})/i,
    destination: /(?:to|destination|arrival)[:\s]*([A-Z]{3})/i,
    departureDate: /(?:departure|departing|leaves)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    departureTime: /(?:departure time|departs)[:\s]*(\d{1,2}:\d{2}\s*[AP]M)/i,
    arrivalDate: /(?:arrival|arriving|arrives)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    arrivalTime: /(?:arrival time|arrives)[:\s]*(\d{1,2}:\d{2}\s*[AP]M)/i,
    confirmationCode: /(?:confirmation|booking|reservation|pnr|record locator)[:\s]*([A-Z0-9]{6,})/i,
    passengerName: /(?:passenger|traveler|name)[:\s]*([A-Za-z\s]+)/i,
    bookingReference: /(?:booking reference|reference number|booking #)[:\s]*([A-Z0-9]+)/i
  };

  const flightData: ParsedFlightData = {};

  // Extract data using patterns
  Object.entries(patterns).forEach(([key, pattern]) => {
    const match = content.match(pattern);
    if (match && match[1]) {
      flightData[key as keyof ParsedFlightData] = match[1].trim();
    }
  });

  // Additional parsing for common airline formats
  if (!flightData.airline) {
    const airlineMatch = content.match(/(jetblue|american|delta|united|southwest|alaska|spirit|frontier|hawaiian)/i);
    if (airlineMatch) {
      flightData.airline = airlineMatch[1];
    }
  }

  // Check if we found enough data to consider this a flight booking
  const hasFlightInfo = flightData.airline || flightData.flightNumber || 
                       (flightData.origin && flightData.destination) ||
                       flightData.confirmationCode;

  return hasFlightInfo ? flightData : null;
}
