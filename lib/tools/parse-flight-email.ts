import { tool } from "ai";
import { z } from "zod";
import { cohere } from "@ai-sdk/cohere";
import { streamText } from "ai";

export const parseFlightEmailTool = tool({
  description: "Intelligently parse flight information from email content using AI",
  parameters: z.object({
    emailSubject: z.string().describe("The email subject line"),
    emailContent: z.string().describe("The full email content (text and HTML combined)"),
  }),
  execute: async ({ emailSubject, emailContent }) => {
    try {
      console.log('🤖 Starting intelligent flight email parsing...');
      
      const prompt = `You are an expert at parsing flight booking emails. Extract flight information from the following email and return it as a JSON object.

Email Subject: ${emailSubject}
Email Content: ${emailContent}

Please extract the following information and return ONLY a valid JSON object with these exact field names:
- airline: The airline name (e.g., "JetBlue", "American Airlines")
- flightNumber: The flight number (e.g., "B6 456", "AA 123")
- origin: The departure airport code (e.g., "JFK", "LAX")
- destination: The arrival airport code (e.g., "LAX", "JFK")
- departureDate: The departure date in YYYY-MM-DD format
- departureTime: The departure time in HH:MM format (24-hour)
- arrivalDate: The arrival date in YYYY-MM-DD format (if different from departure)
- arrivalTime: The arrival time in HH:MM format (24-hour)
- confirmationCode: The booking confirmation code
- passengerName: The passenger's name
- bookingReference: The booking reference number

If any information is not found, use null for that field. Return ONLY the JSON object, no other text.

Example output:
{
  "airline": "JetBlue",
  "flightNumber": "B6 456",
  "origin": "JFK",
  "destination": "LAX",
  "departureDate": "2024-12-15",
  "departureTime": "10:30",
  "arrivalDate": "2024-12-15",
  "arrivalTime": "14:15",
  "confirmationCode": "ABC123",
  "passengerName": "John Smith",
  "bookingReference": "JBL456789"
}`;

      const result = await streamText({
        model: cohere("command-r-plus"),
        maxSteps: 1,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      let response = '';
      for await (const chunk of result.textStream) {
        response += chunk;
      }

      console.log('🤖 AI parsing response:', response);

      // Try to extract JSON from the response
      let parsedData;
      try {
        // Look for JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          parsedData = JSON.parse(response);
        }
      } catch (parseError) {
        console.error('🤖 Failed to parse AI response as JSON:', parseError);
        console.log('🤖 Raw response was:', response);
        
        // Fallback to basic parsing
        return {
          success: false,
          error: "Failed to parse AI response",
          fallbackData: {
            airline: null,
            flightNumber: null,
            origin: null,
            destination: null,
            departureDate: null,
            departureTime: null,
            arrivalDate: null,
            arrivalTime: null,
            confirmationCode: null,
            passengerName: null,
            bookingReference: null
          }
        };
      }

      console.log('🤖 Successfully parsed flight data:', parsedData);

      return {
        success: true,
        data: parsedData
      };

    } catch (error) {
      console.error('🤖 Error in flight email parsing:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackData: {
          airline: null,
          flightNumber: null,
          origin: null,
          destination: null,
          departureDate: null,
          departureTime: null,
          arrivalDate: null,
          arrivalTime: null,
          confirmationCode: null,
          passengerName: null,
          bookingReference: null
        }
      };
    }
  },
});
