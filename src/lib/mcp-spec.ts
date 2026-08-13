/**
 * Builders for the downloadable MCP spec files exposed on /mcp-docs.
 * Everything is derived from the documented tool list so the download
 * always matches what the page shows.
 */

export type SpecToolInput = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

export type SpecTool = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  input: SpecToolInput[];
  output: string;
  example: Record<string, unknown>;
};

const SERVER_NAME = "elias-masaje-website";
const SERVER_TITLE = "Elias Masaje Website";
const SERVER_VERSION = "0.1.0";
const PROTOCOL_VERSION = "2025-06-18";

/** Map the human-readable type label used in the docs to a JSON Schema type. */
const jsonType = (type: string): { type: string; format?: string } => {
  const t = type.toLowerCase();
  if (t.includes("uuid")) return { type: "string", format: "uuid" };
  if (t.includes("integer") || t.includes("number")) return { type: "integer" };
  if (t.includes("boolean")) return { type: "boolean" };
  if (t.includes("array")) return { type: "array" };
  if (t.includes("object")) return { type: "object" };
  return { type: "string" };
};

export const buildToolSchema = (tool: SpecTool) => {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const param of tool.input) {
    properties[param.name] = { ...jsonType(param.type), description: param.description };
    if (param.required) required.push(param.name);
  }
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    annotations: {
      readOnlyHint: tool.readOnly,
      destructiveHint: false,
      idempotentHint: tool.readOnly,
      openWorldHint: false,
    },
    inputSchema: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
      additionalProperties: false,
    },
    example: {
      request: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool.name, arguments: tool.example },
      },
      structuredContent: tool.output,
    },
  };
};

/** Minimal client config, the file most MCP clients expect as `mcp.json`. */
export const buildMcpJson = (endpoint: string) => ({
  mcpServers: {
    [SERVER_NAME]: {
      type: "http",
      url: endpoint,
    },
  },
});

/** Full spec: connection details, auth, and every tool schema. */
export const buildFullSpec = (endpoint: string, tools: SpecTool[]) => ({
  $schema: "https://modelcontextprotocol.io/schema/2025-06-18",
  generatedAt: new Date().toISOString(),
  server: {
    name: SERVER_NAME,
    title: SERVER_TITLE,
    version: SERVER_VERSION,
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http",
    endpoint,
  },
  auth: {
    type: "oauth2.1",
    dynamicClientRegistration: true,
    consentUrl: `${typeof window !== "undefined" ? window.location.origin : ""}/.lovable/oauth/consent`,
    resourceMetadata: `${endpoint}/.well-known/oauth-protected-resource`,
  },
  client: buildMcpJson(endpoint),
  tools: tools.map(buildToolSchema),
});

export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
