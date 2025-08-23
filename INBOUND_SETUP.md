# Email Forwarding Setup with Inbound.new

This feature allows users to forward their flight booking emails to automatically parse and add flights to their timeline.

## How it Works

1. **User forwards booking emails** to their unique Inbound.new address
2. **Inbound.new sends webhook** to our `/api/inbound-webhook` endpoint
3. **We parse the email** and extract flight information
4. **Flight appears in pending queue** for user to review and assign to trips
5. **User assigns flight to trip** and it gets added to their timeline

## Setup Instructions

### 1. Inbound.new Configuration

1. Go to [inbound.new](https://inbound.new) and create an account
2. Create a new inbox for your application
3. Configure the webhook URL to point to your application:
   ```
   https://your-domain.com/api/inbound-webhook
   ```
4. Set the webhook method to `POST`
5. Configure any additional settings (email filtering, etc.)

### 2. Environment Variables

Add these to your `.env` file:

```env
# Inbound.new webhook secret (optional but recommended)
INBOUND_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Email Address Pattern

The system generates unique email addresses for users using this pattern:
```
flights.{username}@inbound.new
```

For example: `flights.john.doe@inbound.new`

### 4. Supported Email Types

The parser looks for flight booking emails from:
- JetBlue
- American Airlines
- Delta Air Lines
- United Airlines
- Southwest Airlines
- Alaska Airlines
- Spirit Airlines
- And many other airlines

### 5. Parsed Data

The system extracts the following information from emails:
- Airline name
- Flight number
- Origin airport (IATA code)
- Destination airport (IATA code)
- Departure date and time
- Arrival date and time
- Confirmation code
- Passenger name
- Booking reference

## Testing

### Test Email Format

Send a test email to your Inbound.new address with content like:

```
Subject: Flight Confirmation - JetBlue Flight 123

Dear John Doe,

Your flight has been confirmed:

Flight: JetBlue 123
From: JFK (New York)
To: LAX (Los Angeles)
Date: December 15, 2024
Departure: 10:30 AM
Arrival: 2:15 PM
Confirmation Code: ABC123
Booking Reference: XYZ789

Thank you for choosing JetBlue!
```

### Manual Testing

1. Forward a real booking email to your Inbound.new address
2. Check the webhook logs in your application
3. Verify the flight appears in the pending flights modal
4. Test assigning it to a trip

## Troubleshooting

### Common Issues

1. **Webhook not receiving emails**
   - Check Inbound.new webhook configuration
   - Verify the webhook URL is correct
   - Check server logs for errors

2. **Flight data not parsing correctly**
   - Review the email format
   - Check the regex patterns in `/api/inbound-webhook/route.ts`
   - Add more airline-specific patterns if needed

3. **User not found**
   - Ensure the user's email is properly linked to their account
   - Check the database for user records

### Debugging

Enable detailed logging by adding console.log statements in the webhook handler:

```typescript
console.log('Inbound webhook received:', JSON.stringify(body, null, 2));
console.log('Parsed flight data:', flightData);
console.log('User found:', user);
```

## Security Considerations

1. **Webhook Verification**: Implement proper webhook signature verification
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Email Validation**: Validate email addresses and content
4. **User Authorization**: Ensure users can only access their own data

## Future Enhancements

- Support for hotel booking emails
- Support for car rental confirmations
- Automatic trip detection based on dates
- Email templates for better parsing
- Integration with more booking platforms
