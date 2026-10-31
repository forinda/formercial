// The address Chromium opens a render page on: always this machine, with the
// port of the server that serves the page's assets.
type Req = { headers: Record<string, unknown>; socket: { localPort?: number } }

export function renderOrigin(req: Req, configuredPort: number): string {
  // A browser's request: the port it connected to. Never from Host, which the
  // request controls.
  if (!req.headers['x-mcp-tool']) return `http://127.0.0.1:${req.socket.localPort}`
  // A tool call arrives through an in-process server that doesn't serve page
  // assets. Its Host is the address the MCP client reached, already checked
  // local; over stdio there's no port in it, so use the configured one.
  const port = /:(\d+)$/.exec(String(req.headers.host ?? ''))?.[1]
  return `http://127.0.0.1:${port ?? configuredPort}`
}
