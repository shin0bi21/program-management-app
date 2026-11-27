import { Node, SyntaxKind, type CallExpression } from 'ts-morph';
import { parseSourceFile } from '../syntax.ts';
import type { Findings } from '../utils.ts';

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/**
 * Appends source-line findings for backend router handlers missing asyncHandler.
 * @example checkBackendRoutes([], 'README.md', '') // no findings outside backend routes
 */
export function checkBackendRoutes(violations: Findings, file: string, source: string): void {
  // 1. Restrict analysis to backend route modules.
  if (!/^backend\/src\/routes\/.*\.ts$/.test(file)) return;

  // 2. Find router method calls from the parsed TypeScript syntax.
  const sourceFile = parseSourceFile(file, source);
  const routeCalls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(isRouterMethodCall);

  // 3. Report handlers whose final argument lacks the async wrapper.
  for (const call of routeCalls) {
    if (!hasWrappedHandler(call)) {
      violations.push(
        `${file}:${call.getStartLineNumber()} Express route handlers must be wrapped with asyncHandler.`,
      );
    }
  }
}

/**
 * Recognizes supported HTTP methods called directly on the router identifier.
 * @example // isRouterMethodCall(call) is true for router.get('/tasks', handler).
 */
function isRouterMethodCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === 'router'
    && ROUTE_METHODS.has(expression.getName());
}

/**
 * Checks whether the final router argument is an asyncHandler call.
 * @example // hasWrappedHandler(call) is true for router.get('/tasks', asyncHandler(handler)).
 */
function hasWrappedHandler(call: CallExpression): boolean {
  const handler = call.getArguments().at(-1);
  return handler != null
    && Node.isCallExpression(handler)
    && handler.getExpression().getText() === 'asyncHandler';
}
