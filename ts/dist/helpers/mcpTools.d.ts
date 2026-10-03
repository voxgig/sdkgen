type McpTool = {
    op: string;
    name: string;
    entities: any[];
};
declare const MCP_READ_OPS: string[];
declare const MCP_WRITE_OPS: string[];
declare function mcpTools(model: any, target?: string): McpTool[];
export type { McpTool, };
export { mcpTools, MCP_READ_OPS, MCP_WRITE_OPS, };
