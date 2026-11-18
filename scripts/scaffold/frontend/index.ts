#!/usr/bin/env node

// Plan and optionally create frontend scaffold files; see usage() for commands.
// Flow: validate the request, check destinations, then preview or write files.

import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Project, QuoteKind } from 'ts-morph';

import { calendarPlan } from './calendar.ts';
import { dashboardCardPlan } from './dashboard-card.ts';
import { modalPlan } from './modal.ts';
import { pagePlan } from './page.ts';
import { tablePlan } from './table.ts';

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const FORMAT_SETTINGS = {
  convertTabsToSpaces: true,
  ensureNewLineAtEndOfFile: true,
  indentSize: 2,
};

export interface ScaffoldPlan {
  files: Map<string, string>;
}

export interface ScaffoldContext {
  repoRoot: string;
  frontendRoot: string;
  assertInside: (path: string, boundary: string, label: string) => void;
  assertPascalCase: (name: string, label: string) => void;
  componentOwner: (owner: string, name: string, suffix: string, label: string) => string;
  modalOwner: (ownerPath: string) => string;
  pageComponentsOwner: (ownerPath: string, label: string) => string;
  relativeImport: (fromDirectory: string, target: string) => string;
  sourceFile: (path: string, text: string) => string;
}

/**
 * Converts platform path separators to forward slashes for imports and CLI output.
 * @example toPosix('frontend/src') // 'frontend/src'
 */
function toPosix(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Checks whether a destination exists, including symlinks; errors other than missing paths propagate.
 * @example pathExists('/missing/file.ts') // false
 */
function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return false;
    throw cause;
  }
}

/**
 * Accepts path segments containing only PascalCase names; an empty list is valid.
 * @example isPascalCasePath(['Staff', 'Schedules']) // true
 */
function isPascalCasePath(parts: string[]): boolean {
  return parts.every(part => PASCAL_CASE.test(part));
}

/**
 * Checks repository-relative segments for a root or route-family page components directory.
 * @example isDirectPageComponentsOwner('frontend/src/pages/Staff/Hours/components'.split('/')) // true
 */
function isDirectPageComponentsOwner(parts: string[]): boolean {
  // 1. Separate page segments from the components directory.
  const pageParts = parts.slice(3, -1);
  // 2. Accept only root pages or one route family with PascalCase names.
  return parts.slice(0, 3).join('/') === 'frontend/src/pages'
    && parts.at(-1) === 'components'
    && (pageParts.length === 1 || pageParts.length === 2)
    && isPascalCasePath(pageParts);
}

/**
 * Accepts a root page or a route-family page/common pair for modal ownership.
 * @example isModalPagePath(['Staff', 'common']) // true
 */
function isModalPagePath(parts: string[]): boolean {
  // 1. Accept a root page or reject unsupported route-family depth.
  if (parts.length === 1) return isPascalCasePath(parts);
  if (parts.length !== 2 || !PASCAL_CASE.test(parts[0])) return false;

  // 2. Allow either family-common ownership or a named child page.
  return parts[1] === 'common' || PASCAL_CASE.test(parts[1]);
}

/**
 * Checks page modal ownership, allowing PascalCase nested components beneath a page or family-common owner.
 * @example isPageModalOwner('frontend/src/pages/Staff/Hours/components/HourTable'.split('/')) // true
 */
function isPageModalOwner(parts: string[]): boolean {
  // 1. Restrict modal ownership to a page components subtree.
  if (parts.slice(0, 3).join('/') !== 'frontend/src/pages') return false;

  const ownerParts = parts.slice(3);
  const componentsIndex = ownerParts.indexOf('components');
  if (componentsIndex < 1) return false;

  // 2. Validate the page path and every nested component owner.
  const pageParts = ownerParts.slice(0, componentsIndex);
  const nestedOwners = ownerParts.slice(componentsIndex + 1);
  return isModalPagePath(pageParts) && isPascalCasePath(nestedOwners);
}

/**
 * Checks common-feature modal ownership, allowing the shared root or nested feature components.
 * @example isFeatureModalOwner('frontend/src/common/features'.split('/')) // true
 */
function isFeatureModalOwner(parts: string[]): boolean {
  // 1. Accept the common-features root or a subtree beneath it.
  if (parts.slice(0, 4).join('/') !== 'frontend/src/common/features') return false;

  if (parts.length === 4) return true;

  // 2. Require a feature components directory with valid nested owner names.
  const [feature, components, ...nestedOwners] = parts.slice(4);
  return Boolean(feature) && components === 'components' && isPascalCasePath(nestedOwners);
}

/**
 * Supplies frontend preset commands and preview examples without creating files.
 * @example usage().includes('--dry-run') // true
 */
function usage(): string {
  return `Usage:
  npm run scaffold:frontend -- page <PagePath> [--dry-run]
  npm run scaffold:frontend -- modal <owner-path> <NameModal> [--dry-run]
  npm run scaffold:frontend -- table <owner-path> <NameTable> [--dry-run]
  npm run scaffold:frontend -- calendar <owner-path> <NameCalendar> [--dry-run]
  npm run scaffold:frontend -- dashboard <owner-path> <NameDashboardCard> [--dry-run]

Every preset generates implementation files and colocated test outlines together.

Examples:
  npm run scaffold:frontend -- page Leads
  npm run scaffold:frontend -- page Staff/Schedules
  npm run scaffold:frontend -- modal frontend/src/pages/Staff/Schedules/components ScheduleModal
  npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable
  npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar
  npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboardCard --dry-run`;
}

/**
 * Builds guarded frontend destinations and in-memory formatting helpers for the configured repository root.
 * @example createContext().relativeImport('/repo/a', '/repo/b') // '../b'
 */
function createContext(): ScaffoldContext {
  // 1. Resolve repository and frontend boundaries for every planned destination.
  const repoRoot = resolve(process.env.SCAFFOLD_REPO_ROOT ?? resolve(import.meta.dirname, '../../..'));
  const frontendRoot = join(repoRoot, 'frontend/src');

  // 2. Define shared path and naming guards before resolving owners.
  /**
   * Rejects a resolved destination outside its boundary; label identifies the invalid request in errors.
   * @example assertInside('/repo/frontend/src/Page.tsx', '/repo/frontend/src', 'Page') // returns normally
   */
  const assertInside = (path: string, boundary: string, label: string): void => {
    const pathFromBoundary = relative(boundary, path);
    if (pathFromBoundary.startsWith('..') || isAbsolute(pathFromBoundary)) {
      throw new Error(`${label} must stay inside ${toPosix(relative(repoRoot, boundary))}.`);
    }
  };

  /**
   * Rejects a name that is not PascalCase, using label to identify its role.
   * @example assertPascalCase('HourTable', 'Table name') // returns normally
   */
  const assertPascalCase = (name: string, label: string): void => {
    if (!PASCAL_CASE.test(name)) throw new Error(`${label} must use PascalCase.`);
  };

  /**
   * Resolves a repository-relative owner and rejects paths outside frontend source.
   * @example resolveOwner('frontend/src/pages', 'Page owner') // absolute frontend pages path
   */
  const resolveOwner = (ownerPath: string, label: string): string => {
    const owner = resolve(repoRoot, ownerPath);
    assertInside(owner, frontendRoot, label);
    return owner;
  };

  // 3. Validate preset-specific owners against the supported page and feature layouts.
  /**
   * Resolves a root or route-family page components owner, rejecting other directory layouts.
   * @example pageComponentsOwner('frontend/src/pages/Staff/Hours/components', 'Table') // absolute owner path
   */
  const pageComponentsOwner = (ownerPath: string, label: string): string => {
    const owner = resolveOwner(ownerPath, `${label} owner`);
    const parts = toPosix(relative(repoRoot, owner)).split('/');
    if (!isDirectPageComponentsOwner(parts)) {
      throw new Error(`${label} owner must be a root or route-family page components directory.`);
    }
    return owner;
  };

  /**
   * Resolves a supported page or shared-feature modal owner; unsupported layouts throw.
   * @example modalOwner('frontend/src/common/features') // absolute common-features path
   */
  const modalOwner = (ownerPath: string): string => {
    const owner = resolveOwner(ownerPath, 'Modal owner');
    const parts = toPosix(relative(repoRoot, owner)).split('/');
    if (!isPageModalOwner(parts) && !isFeatureModalOwner(parts)) {
      throw new Error('Modal owner must be inside a page, page-family common, the common-features root, or a common-feature components owner.');
    }
    return owner;
  };

  // 4. Supply guarded paths, relative imports, and in-memory source formatting.
  return {
    repoRoot,
    frontendRoot,
    assertInside,
    assertPascalCase,
    /**
     * Validates a PascalCase domain name and required suffix, then returns its directory under owner.
     * @example context.componentOwner('/repo/components', 'HourTable', 'Table', 'Table') // '/repo/components/HourTable'
     */
    componentOwner(owner, name, suffix, label) {
      // 1. Require a domain name with the preset suffix before choosing its directory.
      assertPascalCase(name, `${label} name`);
      if (!name.endsWith(suffix)) throw new Error(`${label} name must end with ${suffix}.`);
      if (name === suffix) {
        throw new Error(`${label} name must include a domain name before ${suffix}.`);
      }
      // 2. Place the component directly under the validated owner.
      return join(owner, name);
    },
    modalOwner,
    pageComponentsOwner,
    /**
     * Returns a relative module path with forward slashes and an explicit relative prefix.
     * @example context.relativeImport('/repo/a', '/repo/a/Modal') // './Modal'
     */
    relativeImport(fromDirectory, target) {
      const path = toPosix(relative(fromDirectory, target));
      return path.startsWith('.') ? path : `./${path}`;
    },
    /**
     * Formats supplied TypeScript source in memory; path labels the source without creating a disk file.
     * @example context.sourceFile('/repo/example.ts', 'export const count=1;') // formatted source text
     */
    sourceFile(path, text) {
      // 1. Format generated source in memory without touching the destination.
      const project = new Project({
        manipulationSettings: { quoteKind: QuoteKind.Single },
        skipAddingFilesFromTsConfig: true,
        useInMemoryFileSystem: true,
      });
      // 2. Return the formatted text for later conflict checks and publication.
      const file = project.createSourceFile(toPosix(path), text);
      file.formatText(FORMAT_SETTINGS);
      return file.getFullText();
    },
  };
}

/**
 * Builds a validated preset plan from CLI tokens, rejecting unknown presets or incorrect argument counts.
 * @example parseRequest(context, ['page', 'Hours', '--dry-run']).dryRun // true
 */
function parseRequest(context: ScaffoldContext, argv: string[]): { dryRun: boolean; plan: ScaffoldPlan } {
  // 1. Separate preview mode from the preset and positional arguments.
  const dryRun = argv.includes('--dry-run');
  const positional = argv.filter(argument => argument !== '--dry-run');
  const [kind, ...args] = positional;

  // 2. Require the exact argument count for the selected preset.
  if (kind === 'page' && args.length === 1) return { dryRun, plan: pagePlan(context, args[0]) };
  if (kind === 'modal' && args.length === 2) return { dryRun, plan: modalPlan(context, args[0], args[1]) };
  if (kind === 'table' && args.length === 2) return { dryRun, plan: tablePlan(context, args[0], args[1]) };
  if (kind === 'calendar' && args.length === 2) return { dryRun, plan: calendarPlan(context, args[0], args[1]) };
  if (kind === 'dashboard' && args.length === 2) return { dryRun, plan: dashboardCardPlan(context, args[0], args[1]) };
  throw new Error(usage());
}

/**
 * Plans frontend implementation and test files, rejecting overwrites; dry-run returns paths without writing.
 * @example scaffoldFrontend(['page', 'Hours', '--dry-run']) // planned repository-relative paths
 */
export function scaffoldFrontend(argv: string[]): string[] {
  // 1. Validate the request and every planned destination before creating files.
  const context = createContext();
  const { dryRun, plan } = parseRequest(context, argv);
  plan.files.forEach((_contents, path) => {
    context.assertInside(path, context.frontendRoot, 'Scaffold destination');
  });

  // 2. Reject existing destinations so scaffolding never overwrites an owner.
  const conflicts = [...plan.files.keys()].filter(pathExists);
  if (conflicts.length) {
    throw new Error(`Refusing to overwrite existing files:\n${conflicts.map(toPosix).join('\n')}`);
  }

  // 3. Return repository-relative destinations immediately for a dry run.
  const plannedFiles = [...plan.files.keys()].map(path => toPosix(relative(context.repoRoot, path)));
  if (dryRun) return plannedFiles;

  // 4. Create missing directories and publish each file exclusively.
  plan.files.forEach((contents, path) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents, { flag: 'wx' });
  });
  return plannedFiles;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length === 3 && ['--help', '-h'].includes(process.argv[2])) {
    console.log(usage());
    process.exit(0);
  }
  try {
    const files = scaffoldFrontend(process.argv.slice(2));
    console.log(files.join('\n'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
