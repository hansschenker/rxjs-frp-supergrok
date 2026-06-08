import { from, Observable, throwError, timer } from 'rxjs';
import { catchError, map, retry, timeout } from 'rxjs/operators';

/**
 * Reactive MCP Client
 * 
 * A clean RxJS wrapper around MCP (Model Context Protocol) tool calls.
 * Works with mcp-lite servers and any Streamable HTTP MCP endpoint.
 * 
 * Designed for agent-native applications and educational use in RxJS FRP courses.
 */
export interface McpToolCallOptions<TInput = any> {
  toolName: string;
  input: TInput;
  timeoutMs?: number;
  retries?: number;
}

export class ReactiveMcpClient {
  constructor(private baseUrl: string) {}

  /**
   * Call an MCP tool and return the result as an Observable.
   * Prefers structuredContent when available for better type safety with agents.
   */
  callTool<TInput = any, TOutput = any>(
    options: McpToolCallOptions<TInput>
  ): Observable<TOutput> {
    const { toolName, input, timeoutMs = 15000, retries = 2 } = options;

    return from(
      fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: input,
          },
        }),
      }).then(res => res.json())
    ).pipe(
      timeout(timeoutMs),
      retry({
        count: retries,
        delay: (error, retryCount) => timer(300 * retryCount),
      }),
      map((response: any) => {
        if (response.error) {
          throw new Error(`MCP Error [${toolName}]: ${response.error.message}`);
        }
        // Prefer structuredContent for strong typing in agent workflows
        return response.result?.structuredContent ?? response.result?.content;
      }),
      catchError(err => {
        console.error(`[ReactiveMcpClient] Tool "${toolName}" failed:`, err);
        return throwError(() => err);
      })
    );
  }

  /**
   * List all available tools from the MCP server.
   * Useful for dynamic agent behavior and discovery.
   */
  listTools(): Observable<any[]> {
    return from(
      fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: crypto.randomUUID(),
          method: 'tools/list',
        }),
      }).then(res => res.json())
    ).pipe(
      map((res: any) => res.result?.tools ?? [])
    );
  }
}
