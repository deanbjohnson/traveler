import { tool } from "ai";
import { z } from "zod";

export const foobarTool = tool({
  description: "A placeholder tool that demonstrates basic functionality",
  parameters: z.object({
    message: z.string().describe("A message to process"),
    count: z.number().optional().describe("Optional count parameter"),
  }),
  execute: async ({ message, count = 1 }) => {
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      processed: true,
      originalMessage: message,
      repeatedMessage: Array(count).fill(message).join(" "),
      timestamp: new Date().toISOString(),
    };
  },
});
