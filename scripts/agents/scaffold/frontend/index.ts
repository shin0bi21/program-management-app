#!/usr/bin/env node

import { lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Project, QuoteKind } from 'ts-morph';

import { calendarPlan } from './components/calendars/calendar.ts';
import { dashboardPlan } from './components/dashboards/dashboard.ts';
import { modalPlan } from './components/overlays/modal.ts';
import { tablePlan } from './components/tables/table.ts';
import { pagePlan } from './pages/page.ts';

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
  assertModalOwner: (ownerPath: string) => void;
  assertPageComponentsOwner: (ownerPath: string, label: string) => void;
  assertPascalCase: (name: string, label: string) => void;
  assertSafeFilesystemPath: (path: string, boundary: string, label: string) => void;
  componentOwner: (ownerPath: string, name: string, suffix: string, label: string) => string;
  relativeImport: (fromDirectory: string, target: string) => string;
  sourceFile: (path: string, text: string) => string;
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return false;
    throw cause;
  }
}

function usage(): string {
  return `Usage:
  npm run scaffold:frontend -- page <PagePath> [--dry-run]
  npm run scaffold:frontend -- modal <owner-path> <NameModal> [--dry-run]
  npm run scaffold:frontend -- table <owner-path> <NameTable> [--dry-run]
  npm run scaffold:frontend -- calendar <owner-path> <NameCalendar> [--dry-run]
  npm run scaffold:frontend -- dashboard <owner-path> <NameDashboard> [--dry-run]

Examples:
  npm run scaffold:frontend -- page Leads
  npm run scaffold:frontend -- page Staff/Schedules
  npm run scaffold:frontend -- modal frontend/src/pages/Staff/Schedules/components ScheduleModal
  npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable
  npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar
  npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run`;
}

function createContext(): ScaffoldContext {
  const repoRoot = resolve(process.env.SCAFFOLD_REPO_ROOT ?? resolve(import.meta.dirname, '../../../..'));
  const frontendRoot = join(repoRoot, 'frontend/src');

  const assertInside = (path: string, boundary: string, label: string): void => {
    const pathFromBoundary = relative(boundary, path);
    if (pathFromBoundary.startsWith('..') || isAbsolute(pathFromBoundary)) {
      throw new Error(`${label} must stay inside ${toPosix(relative(repoRoot, boundary))}.`);
    }
  };

  const assertPascalCase = (name: string, label: string): void => {
    if (!PASCAL_CASE.test(name)) throw new Error(`${label} must use PascalCase.`);
  };

  const assertSafeFilesystemPath = (path: string, boundary: string, label: string): void => {
    assertInside(path, boundary, label);

    const canonicalBoundary = realpathSync(boundary);
    if (lstatSync(boundary).isSymbolicLink()) {
      throw new Error(`${label} boundary must not be a symbolic link.`);
    }

    let existingAncestor = boundary;
    const pathParts = relative(boundary, path).split(sep).filter(Boolean);
    for (const part of pathParts) {
      const candidate = join(existingAncestor, part);
      if (!pathExists(candidate)) break;

      const metadata = lstatSync(candidate);
      if (metadata.isSymbolicLink()) {
        throw new Error(`${label} must not traverse a symbolic link: ${toPosix(candidate)}.`);
      }
      existingAncestor = candidate;
    }

    assertInside(realpathSync(existingAncestor), canonicalBoundary, label);
  };

  const resolveOwner = (ownerPath: string, label: string): string => {
    const owner = resolve(repoRoot, ownerPath);
    assertInside(owner, frontendRoot, label);
    return owner;
  };

  const relativeOwnerParts = (ownerPath: string, label: string): string[] => (
    toPosix(relative(repoRoot, resolveOwner(ownerPath, label))).split('/')
  );

  const assertPageComponentsOwner = (ownerPath: string, label: string): void => {
    const parts = relativeOwnerParts(ownerPath, `${label} owner`);
    const pageParts = parts.slice(3);
    const rootPage = pageParts.length === 2
      && PASCAL_CASE.test(pageParts[0])
      && pageParts[1] === 'components';
    const familyPage = pageParts.length === 3
      && PASCAL_CASE.test(pageParts[0])
      && PASCAL_CASE.test(pageParts[1])
      && pageParts[2] === 'components';

    if (parts.slice(0, 3).join('/') !== 'frontend/src/pages' || (!rootPage && !familyPage)) {
      throw new Error(`${label} owner must be a root or route-family page components directory.`);
    }
  };

  const assertModalOwner = (ownerPath: string): void => {
    const parts = relativeOwnerParts(ownerPath, 'Modal owner');
    const pagePrefix = parts.slice(0, 3).join('/') === 'frontend/src/pages';
    const featurePrefix = parts.slice(0, 4).join('/') === 'frontend/src/common/features';
    let valid = false;

    if (pagePrefix) {
      const ownerParts = parts.slice(3);
      const componentsIndex = ownerParts.indexOf('components');
      const prefix = ownerParts.slice(0, componentsIndex);
      const nestedOwners = ownerParts.slice(componentsIndex + 1);
      const rootPage = prefix.length === 1 && PASCAL_CASE.test(prefix[0]);
      const familyPage = prefix.length === 2
        && PASCAL_CASE.test(prefix[0])
        && PASCAL_CASE.test(prefix[1]);
      const familyCommon = prefix.length === 2
        && PASCAL_CASE.test(prefix[0])
        && prefix[1] === 'common';
      valid = componentsIndex >= 0
        && (rootPage || familyPage || familyCommon)
        && nestedOwners.every(owner => PASCAL_CASE.test(owner));
    }

    if (featurePrefix) {
      const ownerParts = parts.slice(4);
      const nestedOwners = ownerParts.slice(2);
      valid = ownerParts.length >= 2
        && ownerParts[1] === 'components'
        && nestedOwners.every(owner => PASCAL_CASE.test(owner));
    }

    if (!valid) {
      throw new Error('Modal owner must be inside a page, page-family common, or common-feature components owner.');
    }
  };

  return {
    repoRoot,
    frontendRoot,
    assertInside,
    assertModalOwner,
    assertPageComponentsOwner,
    assertPascalCase,
    assertSafeFilesystemPath,
    componentOwner(ownerPath, name, suffix, label) {
      assertPascalCase(name, `${label} name`);
      if (!name.endsWith(suffix)) throw new Error(`${label} name must end with ${suffix}.`);
      if (name === suffix) {
        throw new Error(`${label} name must include a domain name before ${suffix}.`);
      }
      return join(resolveOwner(ownerPath, `${label} owner`), name);
    },
    relativeImport(fromDirectory, target) {
      const path = toPosix(relative(fromDirectory, target));
      return path.startsWith('.') ? path : `./${path}`;
    },
    sourceFile(path, text) {
      const project = new Project({
        manipulationSettings: { quoteKind: QuoteKind.Single },
        skipAddingFilesFromTsConfig: true,
        useInMemoryFileSystem: true,
      });
      const file = project.createSourceFile(toPosix(path), text);
      file.formatText(FORMAT_SETTINGS);
      return file.getFullText();
    },
  };
}

function parseRequest(context: ScaffoldContext, argv: string[]): { dryRun: boolean; plan: ScaffoldPlan } {
  const dryRun = argv.includes('--dry-run');
  const positional = argv.filter(argument => argument !== '--dry-run');
  const [kind, ...args] = positional;

  if (kind === 'page' && args.length === 1) return { dryRun, plan: pagePlan(context, args[0]) };
  if (kind === 'modal' && args.length === 2) return { dryRun, plan: modalPlan(context, args[0], args[1]) };
  if (kind === 'table' && args.length === 2) return { dryRun, plan: tablePlan(context, args[0], args[1]) };
  if (kind === 'calendar' && args.length === 2) return { dryRun, plan: calendarPlan(context, args[0], args[1]) };
  if (kind === 'dashboard' && args.length === 2) return { dryRun, plan: dashboardPlan(context, args[0], args[1]) };
  throw new Error(usage());
}

export function scaffoldFrontend(argv: string[]): string[] {
  const context = createContext();
  const { dryRun, plan } = parseRequest(context, argv);
  plan.files.forEach((_contents, path) => {
    context.assertSafeFilesystemPath(path, context.frontendRoot, 'Scaffold destination');
  });

  const conflicts = [...plan.files.keys()].filter(pathExists);
  if (conflicts.length) {
    throw new Error(`Refusing to overwrite existing files:\n${conflicts.map(toPosix).join('\n')}`);
  }

  const plannedFiles = [...plan.files.keys()].map(path => toPosix(relative(context.repoRoot, path)));
  if (dryRun) return plannedFiles;

  plan.files.forEach((contents, path) => {
    mkdirSync(dirname(path), { recursive: true });
    context.assertSafeFilesystemPath(path, context.frontendRoot, 'Scaffold destination');
    writeFileSync(path, contents, { flag: 'wx' });
  });
  return plannedFiles;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const files = scaffoldFrontend(process.argv.slice(2));
    console.log(files.join('\n'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
