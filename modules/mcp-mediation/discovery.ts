import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { createMcpConnector } from './repository';
import type { McpConnectorSummary } from './types';

export interface DiscoveredMcpTool {
  id: string;
  connectorId: string;
  toolName: string;
  description: string | null;
  inputSchema: unknown;
  outputSchema: unknown;
  importedAsSkill: boolean;
}

export interface McpDiscoveryResult {
  connector: McpConnectorSummary;
  tools: DiscoveredMcpTool[];
  executionPerformed: false;
  sourceOfTruth: 'STITCH';
}

export async function discoverRemoteMcpTools(input: {
  requesterRole: string;
  requesterUserId: string;
  name: string;
  endpointUrl: string;
  targetSystem: string;
  description?: string;
}): Promise<McpDiscoveryResult> {
  if (input.requesterRole !== 'admin' && input.requesterRole !== 'cco') {
    throw new ForbiddenError('Admin or CCO access required for MCP discovery');
  }

  const url = new URL(input.endpointUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new ForbiddenError('Only HTTP or HTTPS MCP endpoints can be discovered');
  }

  const discoveredTools = await listToolsFromMcpEndpoint(url);
  const connector = await createMcpConnector({
    name: input.name,
    description: input.description || `Remote MCP connector discovered from ${url.origin}`,
    connectorType: 'remote_mcp',
    targetSystem: input.targetSystem,
    status: 'planned',
    isExternal: true,
    supportsRead: true,
    supportsWrite: false,
    m4Allowed: true,
    m5Allowed: false,
    credentialRequired: true,
    ownerSubstrate: `remote_mcp:${url.origin}`,
  });

  const tools = await Promise.all(discoveredTools.map(async (tool) => {
    const record = await prisma.mcpDiscoveredTool.upsert({
      where: {
        mcp_connector_id_tool_name: {
          mcp_connector_id: connector.id,
          tool_name: tool.name,
        },
      },
      create: {
        mcp_connector_id: connector.id,
        tool_name: tool.name,
        description: tool.description,
        input_schema: toJson(tool.inputSchema),
        output_schema: toJson(tool.outputSchema),
        imported_as_skill: false,
      },
      update: {
        description: tool.description,
        input_schema: toJson(tool.inputSchema),
        output_schema: toJson(tool.outputSchema),
      },
    });
    return mapDiscoveredTool(record);
  }));

  auditLog(
    {
      actor: `user:${input.requesterUserId}`,
      action: 'mcp_remote_discovered',
      object_type: 'mcp_connector',
      object_id: connector.id,
      result: 'success',
    },
    `Remote MCP connector discovered: ${input.name} with ${tools.length} tools`,
  );

  return {
    connector,
    tools,
    executionPerformed: false,
    sourceOfTruth: 'STITCH',
  };
}

export async function listDiscoveredTools(connectorId: string): Promise<DiscoveredMcpTool[]> {
  const tools = await prisma.mcpDiscoveredTool.findMany({
    where: { mcp_connector_id: connectorId },
    orderBy: { tool_name: 'asc' },
  });
  return tools.map(mapDiscoveredTool);
}

async function listToolsFromMcpEndpoint(url: URL): Promise<Array<{
  name: string;
  description: string | null;
  inputSchema: unknown;
  outputSchema: unknown;
}>> {
  const client = new Client({ name: 'tanaghum-stitch-discovery', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(url);
  await client.connect(transport);
  try {
    const result = await client.listTools();
    const record = result as Record<string, unknown>;
    const tools = Array.isArray(record.tools) ? record.tools as Array<Record<string, unknown>> : [];
    return tools.map((tool) => ({
      name: typeof tool.name === 'string' ? tool.name : 'unnamed_tool',
      description: typeof tool.description === 'string' ? tool.description : null,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: tool.outputSchema ?? null,
    }));
  } finally {
    await client.close();
  }
}

function mapDiscoveredTool(tool: {
  id: string;
  mcp_connector_id: string;
  tool_name: string;
  description: string | null;
  input_schema: unknown;
  output_schema: unknown;
  imported_as_skill: boolean;
}): DiscoveredMcpTool {
  return {
    id: tool.id,
    connectorId: tool.mcp_connector_id,
    toolName: tool.tool_name,
    description: tool.description,
    inputSchema: tool.input_schema,
    outputSchema: tool.output_schema,
    importedAsSkill: tool.imported_as_skill,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
