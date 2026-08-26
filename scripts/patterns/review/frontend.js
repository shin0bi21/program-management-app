import { dirname } from 'node:path/posix';
import tseslint from 'typescript-eslint';

// Review findings report signals only. They do not score complexity or fail CI.
const REACT_STATE_HOOKS = new Set(['useReducer', 'useState']);
const REACT_EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect']);
const QUERY_HOOKS = new Set(['useInfiniteQuery', 'useMutation', 'useQuery', 'useQueryClient']);
const CACHE_METHODS = new Set([
  'cancelQueries',
  'invalidateQueries',
  'removeQueries',
  'resetQueries',
  'setQueriesData',
  'setQueryData',
]);
const EXTERNAL_LIFECYCLES = new Set([
  'AbortController',
  'MutationObserver',
  'ResizeObserver',
  'requestAnimationFrame',
  'setInterval',
  'setTimeout',
]);
const ROUTE_SURFACES = new Set(['TimelineCalendar', 'Table']);
// A reviewed exception must name its category and explain why it remains inline.
const SUPPRESSION_PATTERN = /^[ \t]*\/\/[ \t]*pattern-review-ignore[ \t]+([a-z-]+)[ \t]*:[ \t]*(\S.*)$/gm;

function collectSuppressions(source) {
  return new Set(
    [...source.matchAll(SUPPRESSION_PATTERN)]
      .filter((match) => match[2].trim().length > 0)
      .map((match) => match[1]),
  );
}

function jsxName(node) {
  if (node?.type === 'JSXIdentifier') return node.name;
  if (node?.type === 'JSXMemberExpression') return jsxName(node.property);
  return null;
}

function propertyName(node) {
  if (!node || node.computed) return null;
  return node.property?.type === 'Identifier' ? node.property.name : null;
}

function isTestFile(file) {
  return /\.(?:test|spec|story)\.[cm]?[jt]sx?$/.test(file);
}

function isAuditedFrontendOwner(file) {
  return file.startsWith('frontend/src/pages/')
    || file.startsWith('frontend/src/common/components/')
    || file.startsWith('frontend/src/common/features/');
}

function isApiAdapter(file) {
  return file.includes('/api/') || file.endsWith('.api.ts');
}

function routeDirectoryFor(file, routePageDirectories) {
  return routePageDirectories.find((directory) => {
    const pageName = directory.split('/').at(-1);
    return file === `${directory}/${pageName}.tsx`;
  });
}

function collectMetrics(file, source) {
  const parsed = tseslint.parser.parseForESLint(source, {
    comment: false,
    filePath: file,
    jsx: file.endsWith('.tsx'),
    loc: true,
    range: true,
    sourceType: 'module',
  });
  const visitorKeys = parsed.visitorKeys;
  const metrics = {
    apiCalls: 0,
    cacheCalls: 0,
    effects: 0,
    externalLifecycles: 0,
    queryHooks: 0,
    renderedRouteSurfaces: new Set(),
    stateHooks: 0,
    emptyFilterFallbacks: [],
    compatibilityNormalizations: [],
    exportedTypes: [],
  };
  const apiImports = new Set();

  function walk(node) {
    if (!node || typeof node.type !== 'string') return;

    if (node.type === 'ImportDeclaration') {
      const sourceValue = node.source.value;
      const isApiImport = typeof sourceValue === 'string'
        && (sourceValue.includes('/api/') || sourceValue.endsWith('.api'));
      for (const specifier of node.specifiers) {
        if (specifier.local?.name) {
          if (isApiImport) apiImports.add(specifier.local.name);
        }
      }
    }

    if (node.type === 'ExportNamedDeclaration'
      && (node.declaration?.type === 'TSInterfaceDeclaration'
        || node.declaration?.type === 'TSTypeAliasDeclaration')) {
      metrics.exportedTypes.push({
        line: node.declaration.loc.start.line,
        name: node.declaration.id.name,
      });
    }

    if (node.type === 'CallExpression') {
      const calleeName = node.callee.type === 'Identifier' ? node.callee.name : null;
      if (calleeName && REACT_STATE_HOOKS.has(calleeName)) metrics.stateHooks += 1;
      if (calleeName && REACT_EFFECT_HOOKS.has(calleeName)) metrics.effects += 1;
      if (calleeName && QUERY_HOOKS.has(calleeName)) metrics.queryHooks += 1;
      if (calleeName && apiImports.has(calleeName)) metrics.apiCalls += 1;
      if (calleeName && EXTERNAL_LIFECYCLES.has(calleeName)) metrics.externalLifecycles += 1;

      const memberMethod = node.callee.type === 'MemberExpression'
        ? propertyName(node.callee)
        : null;
      if (memberMethod && CACHE_METHODS.has(memberMethod)) metrics.cacheCalls += 1;
      if (node.callee.type === 'MemberExpression'
        && node.callee.object.type === 'Identifier'
        && node.callee.object.name === 'Array'
        && memberMethod === 'isArray'
        && !isApiAdapter(file)) {
        metrics.compatibilityNormalizations.push(node.loc.start.line);
      }
    }

    if (node.type === 'NewExpression'
      && node.callee.type === 'Identifier'
      && EXTERNAL_LIFECYCLES.has(node.callee.name)) {
      metrics.externalLifecycles += 1;
    }

    if (node.type === 'LogicalExpression'
      && node.operator === '??'
      && node.left.type === 'Identifier'
      && /^(?:filters?|params?|query)$/.test(node.left.name)
      && node.right.type === 'ObjectExpression'
      && node.right.properties.length === 0
      && !isApiAdapter(file)) {
      metrics.emptyFilterFallbacks.push(node.loc.start.line);
    }

    if (node.type === 'JSXOpeningElement') {
      const name = jsxName(node.name);
      if (name && ROUTE_SURFACES.has(name)) metrics.renderedRouteSurfaces.add(name);
    }

    for (const key of visitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const entry of child) walk(entry);
      } else {
        walk(child);
      }
    }
  }

  walk(parsed.ast);
  return metrics;
}

function pageTypesDirectoryFor(file, routePageDirectories) {
  return routePageDirectories.find(directory => file === `${directory}/types.ts`) ?? null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function typeOwnershipFindings(file, source, metrics, routePageDirectories, repositorySources) {
  const pageDirectory = pageTypesDirectoryFor(file, routePageDirectories);
  if (!pageDirectory) return [];

  return metrics.exportedTypes.flatMap(({ line, name }) => {
    const patternSource = `\\b${escapeRegExp(name)}\\b`;
    const ownOccurrences = source.match(new RegExp(patternSource, 'g'))?.length ?? 0;
    if (ownOccurrences > 1) return [];

    const consumers = [...repositorySources.entries()]
      .filter(([consumerFile, consumerSource]) => (
        consumerFile !== file
        && consumerFile.startsWith(`${pageDirectory}/`)
        && !isTestFile(consumerFile)
        && new RegExp(patternSource).test(consumerSource)
      ))
      .map(([consumerFile]) => consumerFile);

    if (consumers.length !== 1) return [];
    const [consumer] = consumers;
    if (isApiAdapter(consumer)) {
      return [{
        line,
        message: `exported type ${name} is only consumed by ${consumer}; keep endpoint-only contracts in the API adapter.`,
      }];
    }
    return [{
      line,
      message: `exported type ${name} is only consumed by ${consumer}; keep owner-local contracts beside that component, hook, or page.`,
    }];
  });
}

function describeMetrics(metrics) {
  const descriptions = [];
  if (metrics.stateHooks) descriptions.push(`${metrics.stateHooks} state hooks`);
  if (metrics.effects) descriptions.push(`${metrics.effects} effects`);
  if (metrics.queryHooks) descriptions.push(`${metrics.queryHooks} query/cache hooks`);
  if (metrics.apiCalls) descriptions.push(`${metrics.apiCalls} direct API calls`);
  if (metrics.cacheCalls) descriptions.push(`${metrics.cacheCalls} cache mutations`);
  if (metrics.externalLifecycles) descriptions.push(`${metrics.externalLifecycles} external lifecycles`);
  return descriptions.join(', ');
}

function isCalendarOwner(file) {
  return /\/components\/[^/]*Calendar\/[^/]*Calendar\.tsx$/.test(file);
}

function hasInlineWorkflow(file, metrics) {
  if (isCalendarOwner(file)) {
    return metrics.stateHooks > 0
      || metrics.effects > 1
      || metrics.queryHooks > 0
      || metrics.apiCalls > 1
      || metrics.cacheCalls > 0
      || metrics.externalLifecycles > 0;
  }

  const coordinatedSignals = [
    metrics.effects > 0,
    metrics.queryHooks > 0,
    metrics.apiCalls > 0,
    metrics.cacheCalls > 0,
    metrics.externalLifecycles > 0,
  ].filter(Boolean).length;

  return metrics.stateHooks >= 3
    || coordinatedSignals >= 2
    || (metrics.stateHooks > 0 && coordinatedSignals > 0)
    || metrics.queryHooks > 0
    || metrics.cacheCalls > 0
    || metrics.externalLifecycles > 0;
}

function ownerDirectoryContext(file, repositoryFiles, routeDirectory) {
  const ownerDirectory = routeDirectory ?? dirname(file);
  const missing = [];
  const ownsNestedComponent = repositoryFiles.some((entry) => {
    if (!entry.startsWith(`${ownerDirectory}/`) || !entry.endsWith('.tsx')) return false;
    const relativePath = entry.slice(ownerDirectory.length + 1);
    return relativePath.includes('/') && !relativePath.startsWith('hooks/');
  });
  if (!repositoryFiles.some((entry) => entry.startsWith(`${ownerDirectory}/components/`))
    && !ownsNestedComponent) {
    missing.push('components/');
  }
  if (!repositoryFiles.some((entry) => entry.startsWith(`${ownerDirectory}/hooks/`))) {
    missing.push('hooks/');
  }
  return missing.length ? `; owner has no ${missing.join(' or ')}` : '';
}

const FILE_RULES = [
  {
    category: 'review-page-styles',
    appliesTo: ({ hasPageStyles, routeDirectory }) => routeDirectory && !hasPageStyles,
    message: () => (
      'route page has no page-owned CSS; confirm its presentation is fully delegated to styled child components.'
    ),
  },
  {
    category: 'review-owner-boundary',
    appliesTo: ({ metrics, routeDirectory }) => routeDirectory
      && metrics.renderedRouteSurfaces.size > 0,
    message: ({ metrics, directoryContext }) => (
      `route entry renders ${[...metrics.renderedRouteSurfaces].join(' and ')} directly${directoryContext}.`
    ),
  },
  {
    category: 'review-inline-workflow',
    appliesTo: ({ file, metrics }) => file.endsWith('.tsx') && hasInlineWorkflow(file, metrics),
    message: ({ metrics, directoryContext }) => (
      `TSX file contains inline workflow behavior (${describeMetrics(metrics)})${directoryContext}.`
    ),
  },
];

export function reviewFrontendPatterns(
  findings,
  file,
  source,
  {
    repositoryFiles = [],
    repositorySources = new Map(),
    routePageDirectories = [],
  } = {},
) {
  if (!isAuditedFrontendOwner(file) || isTestFile(file) || !/\.tsx?$/.test(file)) return;

  let metrics;
  try {
    metrics = collectMetrics(file, source);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.split('\n')[0] : 'unknown parse error';
    findings.push(`${file}:1 [review-analysis-skipped] ${message}`);
    return;
  }

  const routeDirectory = routeDirectoryFor(file, routePageDirectories);
  const pageName = routeDirectory?.split('/').at(-1);
  const hasPageStyles = routeDirectory
    ? repositoryFiles.includes(`${routeDirectory}/${pageName}.css`)
    : false;
  const directoryContext = ownerDirectoryContext(file, repositoryFiles, routeDirectory);
  const suppressions = collectSuppressions(source);
  const addAdvisory = (category, line, message) => {
    if (!suppressions.has(category)) {
      findings.push(`${file}:${line} [${category}] ${message}`);
    }
  };

  const context = { directoryContext, file, hasPageStyles, metrics, routeDirectory };
  for (const rule of FILE_RULES) {
    if (rule.appliesTo(context)) addAdvisory(rule.category, 1, rule.message(context));
  }

  for (const line of metrics.emptyFilterFallbacks) {
    addAdvisory(
      'review-defensive-contract',
      line,
      'not-ready query input falls back to an empty object outside an API adapter.',
    );
  }
  for (const line of metrics.compatibilityNormalizations) {
    addAdvisory(
      'review-defensive-contract',
      line,
      'response-shape compatibility is normalized outside an API adapter.',
    );
  }
  for (const finding of typeOwnershipFindings(
    file,
    source,
    metrics,
    routePageDirectories,
    repositorySources,
  )) {
    addAdvisory('review-type-ownership', finding.line, finding.message);
  }
}
