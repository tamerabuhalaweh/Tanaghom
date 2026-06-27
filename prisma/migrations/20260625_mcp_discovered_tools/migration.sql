CREATE TABLE "mcp_discovered_tools" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mcp_connector_id" UUID NOT NULL,
    "tool_name" TEXT NOT NULL,
    "description" TEXT,
    "input_schema" JSONB,
    "output_schema" JSONB,
    "imported_as_skill" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_discovered_tools_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mcp_discovered_tools_mcp_connector_id_tool_name_key"
ON "mcp_discovered_tools"("mcp_connector_id", "tool_name");

CREATE INDEX "mcp_discovered_tools_mcp_connector_id_idx"
ON "mcp_discovered_tools"("mcp_connector_id");

ALTER TABLE "mcp_discovered_tools"
ADD CONSTRAINT "mcp_discovered_tools_mcp_connector_id_fkey"
FOREIGN KEY ("mcp_connector_id") REFERENCES "mcp_connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
