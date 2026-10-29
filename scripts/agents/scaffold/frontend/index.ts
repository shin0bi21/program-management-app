#!/usr/bin/env node

import { lstatSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { Project, QuoteKind } from 'ts-morph';

import { calendarPlan } from './calendar.ts';
import { dashboardPlan } from './dashboard.ts';
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

function isPascalCasePath(parts: string[]): boolean {
  return parts.every(part => PASCAL_CASE.test(part));
}

function isDirectPageComponentsOwner(parts: string[]): boolean {
  const pageParts = parts.slice(3, -1);
  return parts.slice(0, 3).join('/') === 'frontend/src/pages'
    && parts.at(-1) === 'components'
    && (pageParts.length === 1 || pageParts.length === 2)
    && isPascalCasePath(pageParts);
}

function isModalPagePath(parts: string[]): boolean {
  if (parts.length === 1) return isPascalCasePath(parts);
  if (parts.length !== 2 || !PASCAL_CASE.test(parts[0])) return false;

  return parts[1] === 'common' || PASCAL_CASE.test(parts[1]);
}

function isPageModalOwner(parts: string[]): boolean {
  if (parts.slice(0, 3).join('/') !== 'frontend/src/pages') return false;

  const ownerParts = parts.slice(3);
  const componentsIndex = ownerParts.indexOf('components');
  if (componentsIndex < 1) return false;

  const pageParts = ownerParts.slice(0, componentsIndex);
  const nestedOwners = ownerParts.slice(componentsIndex + 1);
  return isModalPagePath(pageParts) && isPascalCasePath(nestedOwners);
}

function isFeatureModalOwner(parts: string[]): boolean {
  if (parts.slice(0, 4).join('/') !== 'frontend/src/common/features') return false;

  if (parts.length === 4) return true;

  const [feature, components, ...nestedOwners] = parts.slice(4);
  return Boolean(feature) && components === 'components' && isPascalCasePath(nestedOwners);
}

function usage(): string {
  return `Usage:
  npm run scaffold:frontend -- page <PagePath> [--dry-run]
  npm run scaffold:frontend -- modal <owner-path> <NameModal> [--dry-run]
  npm run scaffold:frontend -- table <owner-path> <NameTable> [--dry-run]
  npm run scaffold:frontend -- calendar <owner-path> <NameCalendar> [--dry-run]
  npm run scaffold:frontend -- dashboard <owner-path> <NameDashboard> [--dry-run]

Every preset generates implementation files and colocated test outlines together.

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

  const resolveOwner = (ownerPath: string, label: string): string => {
    const owner = resolve(repoRoot, ownerPath);
    assertInside(owner, frontendRoot, label);
    return owner;
  };

  const pageComponentsOwner = (ownerPath: string, label: string): string => {
    const owner = resolveOwner(ownerPath, `${label} owner`);
    const parts = toPosix(relative(repoRoot, owner)).split('/');
    if (!isDirectPageComponentsOwner(parts)) {
      throw new Error(`${label} owner must be a root or route-family page components directory.`);
    }
    return owner;
  };

  const modalOwner = (ownerPath: string): string => {
    const owner = resolveOwner(ownerPath, 'Modal owner');
    const parts = toPosix(relative(repoRoot, owner)).split('/');
    if (!isPageModalOwner(parts) && !isFeatureModalOwner(parts)) {
      throw new Error('Modal owner must be inside a page, page-family common, the common-features root, or a common-feature components owner.');
    }
    return owner;
  };

  return {
    repoRoot,
    frontendRoot,
    assertInside,
    assertPascalCase,
    componentOwner(owner, name, suffix, label) {
      assertPascalCase(name, `${label} name`);
      if (!name.endsWith(suffix)) throw new Error(`${label} name must end with ${suffix}.`);
      if (name === suffix) {
        throw new Error(`${label} name must include a domain name before ${suffix}.`);
      }
      return join(owner, name);
    },
    modalOwner,
    pageComponentsOwner,
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
    context.assertInside(path, context.frontendRoot, 'Scaffold destination');
  });

  const conflicts = [...plan.files.keys()].filter(pathExists);
  if (conflicts.length) {
    throw new Error(`Refusing to overwrite existing files:\n${conflicts.map(toPosix).join('\n')}`);
  }

  const plannedFiles = [...plan.files.keys()].map(path => toPosix(relative(context.repoRoot, path)));
  if (dryRun) return plannedFiles;

  plan.files.forEach((contents, path) => {
    mkdirSync(dirname(path), { recursive: true });
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
