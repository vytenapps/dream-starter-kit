import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Small helpers shared by the tool modules: building MCP tool results and
 * turning thrown errors (Payload access/validation failures) into a clean
 * `isError` result the model can read, rather than a transport-level 500.
 */

export type ToolResult = CallToolResult;

export function jsonResult(
  data: unknown,
  structuredContent?: Record<string, unknown>,
): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/** Run a tool body, converting thrown errors into an `isError` result. */
export async function runTool(
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error running tool";
    return errorResult(message);
  }
}
