import { tool } from "ai";
import { z } from "zod";

export const calculatorTool = tool({
  description: "Perform basic mathematical calculations",
  parameters: z.object({
    expression: z
      .string()
      .describe('A mathematical expression to evaluate (e.g., "2 + 3 * 4")'),
  }),
  execute: async ({ expression }) => {
    try {
      // Simple and safe expression evaluation
      // In production, consider using a proper math parser library like mathjs
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
      const result = Function('"use strict"; return (' + sanitized + ")")();

      if (typeof result !== "number" || !isFinite(result)) {
        throw new Error("Invalid mathematical expression");
      }

      return {
        expression: expression,
        result: result,
        isValid: true,
      };
    } catch {
      return {
        expression: expression,
        result: null,
        isValid: false,
        error: "Invalid mathematical expression",
      };
    }
  },
});
