import apiService from '../apiService';

/**
 * MCP API Service — the authenticated MCP server at /api/mcp.
 *
 * The public /tasks/mcp serves resources only and answers tools/list with []
 * on purpose ("a tool acts, acting needs a scoped credential"). /api/mcp is
 * the same JSON-RPC 2.0 server behind the session's bearer token, with tools
 * scoped to the logged-in account's customer — nothing an agent could not
 * already do over /api. The admin's MCP console speaks to it through here.
 *
 * Backend endpoint:
 *   POST /api/mcp   — JSON-RPC 2.0: initialize, ping, resources/list,
 *                     resources/read, tools/list, tools/call
 */

let nextId = 1;

export const mcpApi = {
  /**
   * Send one JSON-RPC request and answer the whole envelope (result OR error),
   * so the console can show exactly what the server said.
   * @param {string} method
   * @param {object} params
   * @returns {Promise<{jsonrpc: string, id: number, result?: object, error?: object}>}
   */
  rpc: async (method, params = {}) => {
    const id = nextId++;
    // showMessages=false: a JSON-RPC error or a tool's isError is the console's
    // to render, not a global snackbar. skipCircuitBreaker: a failing switch
    // must not trip the breaker for every other screen.
    return apiService.post('/api/mcp', { jsonrpc: '2.0', id, method, params }, {}, 'mcp request', false, true);
  },

  /** @returns {Promise<Array<{name: string, description: string, inputSchema: object}>>} */
  listTools: async () => {
    const envelope = await mcpApi.rpc('tools/list');
    if (envelope?.error) throw new Error(envelope.error.message || 'tools/list failed');
    return envelope?.result?.tools || [];
  },

  /**
   * Call a tool. Answers the MCP result ({content, structuredContent, isError}).
   * A JSON-RPC error (unknown tool, malformed request) is thrown.
   */
  callTool: async (name, args = {}) => {
    const envelope = await mcpApi.rpc('tools/call', { name, arguments: args });
    if (envelope?.error) throw new Error(envelope.error.message || `${name} failed`);
    return envelope?.result;
  },
};

export default mcpApi;
