import { Observable, pipe, timer } from 'rxjs';
import { catchError, map, retry, switchMap } from 'rxjs/operators';

/**
 * Custom RxJS Operators for MCP + Agent Workflows
 * 
 * These operators follow the domain-specific naming and educational style
 * used throughout the RxJS FRP SuperGrok course.
 * 
 * They are designed to make agentic and MCP-based code more readable,
 * resilient, and aligned with FRP thinking.
 */

// ============================================
// 1. mcpToolCall - Clean domain-specific tool invocation
// ============================================

export interface McpToolOptions<TInput> {
  toolName: string;
  input: TInput;
  timeoutMs?: number;
}

/**
 * Calls an MCP tool using a provided client.
 * Replaces verbose switchMap + fetch patterns with clear domain language.
 */
export const mcpToolCall = <TInput, TOutput>(
  client: { callTool: (opts: any) => Observable<TOutput> },
  options: McpToolOptions<TInput>
) =>
  switchMap(() =>
    client.callTool({
      toolName: options.toolName,
      input: options.input,
      timeoutMs: options.timeoutMs ?? 15000,
    })
  );

// ============================================
// 2. retryWithStructuredFallback
// ============================================

/**
 * Retries the upstream observable, then falls back to a structured error tool.
 * Excellent for building resilient agent pipelines.
 */
export const retryWithStructuredFallback = <T>(
  maxRetries = 2,
  fallback$: (error: any) => Observable<T>
) =>
  pipe(
    retry({ count: maxRetries, delay: 400 }),
    catchError((error) =>
      fallback$(error).pipe(
        map((result) => ({
          ...result,
          _recovered: true,
          _originalError: error.message,
        }))
      )
    )
  );

// ============================================
// 3. withAgentContext
// ============================================

/**
 * Injects agent/session context into every tool call.
 * Useful for multi-tenant or session-aware agent systems.
 */
export const withAgentContext = <T extends { context?: any }>(context: any) =>
  map((input: T) => ({
    ...input,
    context: {
      ...input.context,
      ...context,
      timestamp: new Date().toISOString(),
    },
  }));

// ============================================
// 4. agentState (using scan for session history)
// ============================================

interface AgentSessionState {
  toolCalls: any[];
  lastResult?: any;
}

/**
 * Maintains agent session state using classic FRP scan.
 * Enables time-travel and undo patterns for agent workflows.
 */
export const agentState = () =>
  scan((state: AgentSessionState, toolResult: any) => ({
    toolCalls: [...state.toolCalls, toolResult],
    lastResult: toolResult,
  }), {
    toolCalls: [],
  } as AgentSessionState);

// Note: Import { scan } from 'rxjs/operators' when using this operator.
