# AI Tools

This directory contains all AI tools used by the chat API. Tools are organized using Vercel AI SDK best practices for scalability and maintainability.

## Structure

```
lib/tools/
├── index.ts          # Central export file for all tools
├── calculator.ts     # Example calculator tool
└── README.md        # This documentation
```

## Adding a New Tool

1. **Create a new tool file** (e.g., `weather.ts`):

```typescript
import { tool } from "ai";
import { z } from "zod";

export const weatherTool = tool({
  description: "Get weather information for a location",
  parameters: z.object({
    location: z.string().describe("The location to get weather for"),
    unit: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .describe("Temperature unit"),
  }),
  execute: async ({ location, unit = "celsius" }) => {
    // Your tool logic here
    return {
      location,
      temperature: 22,
      unit,
      conditions: "sunny",
    };
  },
});
```

2. **Export the tool in `index.ts`**:

```typescript
// Add to individual exports
export { weatherTool } from "./weather";

// Add to imports
import { weatherTool } from "./weather";

// Add to tools object
export const tools = {
  calculator: calculatorTool,
  weather: weatherTool, // <- Add here
} as const;
```

That's it! The tool will automatically be available to the AI model.

## Tool Naming Conventions

- Use descriptive names for tool functions (e.g., `weatherTool`, `calculatorTool`)
- Keep tool keys in the tools object concise but clear (e.g., `weather`, `calculator`)
- Use camelCase for both file names and tool names

## Best Practices

- Always use the `tool()` helper function for proper TypeScript inference
- Use Zod schemas for parameter validation
- Include clear descriptions for both the tool and its parameters
- Handle errors gracefully in the `execute` function
- Keep tools focused on a single responsibility
- Add proper TypeScript types for complex return values

## Examples

See the existing tools for reference:

- **`calculator.ts`**: Mathematical expression evaluation with error handling
