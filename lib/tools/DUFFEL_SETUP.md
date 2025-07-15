# Duffel API Setup Guide

This guide will help you set up the Duffel API integration for real flight search functionality.

## Prerequisites

1. **Duffel Account**: Sign up at [duffel.com](https://duffel.com)
2. **Access Token**: Get your API access token from [app.duffel.com/settings/access-tokens](https://app.duffel.com/settings/access-tokens)

## Environment Configuration

Add your Duffel access token to your environment variables:

### Option 1: .env.local file (recommended)

Create a `.env.local` file in your project root:

```bash
# Add this to your .env.local file
DUFFEL_ACCESS_TOKEN=your_actual_duffel_access_token_here
```

### Option 2: Environment Variables

Set the environment variable directly:

```bash
export DUFFEL_ACCESS_TOKEN=your_actual_duffel_access_token_here
```

## Testing the Integration

Once configured, you can test the flight search by asking the AI assistant:

- "Find flights from NYC to LAX on 2024-12-25"
- "Search for round-trip flights from London to Paris, departing December 20th and returning December 27th"
- "Find business class flights from San Francisco to Tokyo on January 15th for 2 passengers"

## Features

The flight search tool supports:

- ✅ One-way flights
- ✅ Round-trip flights
- ✅ Multiple passengers
- ✅ Cabin class selection (economy, premium_economy, business, first)
- ✅ Real-time flight data from 300+ airlines
- ✅ Comprehensive flight offers with pricing

## API Limits

- **Test Environment**: Limited to test data
- **Production**: Rate limits apply based on your Duffel plan

## Troubleshooting

### Common Issues

1. **"Module not found" error**: Ensure `@duffel/api` is installed:

   ```bash
   bun add @duffel/api
   ```

2. **"Access token not found" error**: Check your environment variable is set correctly

3. **"Invalid airport code" error**: Use 3-letter IATA codes (e.g., 'NYC', 'LAX', 'LHR')

### Debug Mode

To enable verbose logging, update the Duffel client in `flight-search.ts`:

```typescript
const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN!,
  debug: { verbose: true }, // Add this line
});
```

## Security Notes

- ⚠️ Never commit your access token to version control
- ⚠️ Keep your access token secure and rotate it regularly
- ⚠️ Use test tokens for development, production tokens for live systems

## Documentation

- [Duffel API Documentation](https://duffel.com/docs/api)
- [JavaScript SDK Documentation](https://github.com/duffelhq/duffel-api-javascript)
