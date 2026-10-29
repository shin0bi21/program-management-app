// Navigation follows reader tasks; source paths remain the canonical document identities.
export const navigation = [
  { label: 'Overview', source: 'README.md' },
  {
    label: 'Develop locally',
    items: [
      { label: 'Workflow overview', source: 'docs/workflows/README.md' },
      { label: 'Set up the project', source: 'docs/workflows/setup.md' },
      { label: 'Daily development', source: 'docs/workflows/local-development.md' },
      { label: 'Debug locally', source: 'docs/workflows/debugging.md' },
      { label: 'Refresh local data', source: 'docs/workflows/data-snapshots.md' },
    ],
  },
  {
    label: 'Frontend',
    items: [
      { label: 'Overview', source: 'docs/frontend/README.md' },
      { label: 'Ownership', source: 'docs/frontend/architecture/ownership.md' },
      { label: 'State and data', source: 'docs/frontend/architecture/state-and-data.md' },
      { label: 'Scaffold a feature', source: 'docs/frontend/scaffolding.md' },
      { label: 'Pages', source: 'docs/frontend/pages/README.md' },
      { label: 'Preferences', source: 'docs/frontend/pages/preferences.md' },
      { label: 'UI basics', source: 'docs/frontend/components/README.md' },
      { label: 'Tables', source: 'docs/frontend/components/tables.md' },
      { label: 'Row updates', source: 'docs/frontend/components/table-rows.md' },
      { label: 'Calendars', source: 'docs/frontend/components/calendars.md' },
      { label: 'Dashboards', source: 'docs/frontend/components/dashboards.md' },
      { label: 'Forms', source: 'docs/frontend/components/modals-and-forms.md' },
      { label: 'Overlays', source: 'docs/frontend/components/overlays.md' },
      { label: 'App navigation', source: 'docs/frontend/components/navigation.md' },
    ],
  },
  {
    label: 'Backend',
    items: [
      { label: 'Overview', source: 'docs/backend/README.md' },
      { label: 'Services', source: 'docs/backend/services.md' },
      { label: 'Authentication', source: 'docs/backend/auth.md' },
      { label: 'Authorization and policies', source: 'docs/backend/authorization.md' },
      { label: 'Middleware', source: 'docs/backend/middleware.md' },
      { label: 'HTTP flow', source: 'docs/backend/http.mmd' },
      { label: 'API contracts', source: 'docs/backend/api.md' },
      { label: 'Reference data', source: 'docs/backend/reference-data.md' },
      { label: 'Database', source: 'docs/backend/database.md' },
      { label: 'Errors', source: 'docs/backend/errors.md' },
      { label: 'Testing', source: 'docs/backend/testing.md' },
      { label: 'Google Sheets', source: 'docs/backend/integrations/google-sheets.md' },
    ],
  },
  {
    label: 'Verify and deliver',
    items: [
      { label: 'Testing', source: 'docs/workflows/testing.md' },
      { label: 'Review and merge changes', source: 'docs/workflows/changes.md' },
      { label: 'CI', source: 'docs/workflows/ci.md' },
      { label: 'Repository reports', source: 'docs/workflows/reports.md' },
    ],
  },
  {
    label: 'Operate production',
    items: [
      { label: 'Deploy, verify, and recover', source: 'docs/workflows/deployment.md' },
      { label: 'Access and credential recovery', source: 'docs/workflows/access.md' },
    ],
  },
  { label: 'Documentation website', source: 'docs/README.md' },
];

export function buildSidebar(routes, entries = navigation) {
  const listed = new Set();

  const convert = entry => {
    if (entry.items) return { label: entry.label, items: entry.items.map(convert) };
    if (!Object.hasOwn(routes, entry.source)) throw new Error(`Unknown navigation source: ${entry.source}`);
    if (listed.has(entry.source)) throw new Error(`Duplicate navigation source: ${entry.source}`);

    listed.add(entry.source);
    return { label: entry.label, slug: routes[entry.source].replace(/^\/|\/$/g, '') };
  };

  const sidebar = entries.map(convert);
  const missing = Object.keys(routes).filter(source => !listed.has(source));
  if (missing.length) throw new Error(`Documents missing from navigation: ${missing.join(', ')}`);

  return sidebar;
}
