import type { ModelEntity, SdkModel } from '../types';
type McpTool = {
    op: string;
    name: string;
    entities: ModelEntity[];
};
declare const MCP_READ_OPS: string[];
declare const MCP_WRITE_OPS: string[];
declare function mcpTools(model: SdkModel, target?: string): McpTool[];
export type { McpTool, };
export { mcpTools, MCP_READ_OPS, MCP_WRITE_OPS, };
