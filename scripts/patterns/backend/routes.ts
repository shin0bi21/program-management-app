import { Node, SyntaxKind, type CallExpression } from 'ts-morph';

import { parseSourceFile } from '../syntax.ts';
import type { Findings } from '../utils.ts';

const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

function isRouterMethodCall(call: CallExpression): boolean {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression)
    && expression.getExpression().getText() === 'router'
    && ROUTE_METHODS.has(expression.getName());
}

function hasWrappedHandler(call: CallExpression): boolean {
  const handler = call.getArguments().at(-1);
  return handler != null
    && Node.isCallExpression(handler)
    && handler.getExpression().getText() === 'asyncHandler';
}

export function checkBackendRoutes(violations: Findings, file: string, source: string): void {
  if (!/^backend\/src\/routes\/.*\.ts$/.test(file)) return;

  const sourceFile = parseSourceFile(file, source);
  const routeCalls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(isRouterMethodCall);

  for (const call of routeCalls) {
    if (!hasWrappedHandler(call)) {
      violations.push(
        `${file}:${call.getStartLineNumber()} Express route handlers must be wrapped with asyncHandler.`,
      );
    }
  }
}
