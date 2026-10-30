// Navigation follows reader tasks; source paths remain the canonical document identities.
export const navigation = [
  { label: 'Overview', source: 'README.md' },
  {
    label: 'Local Development',
    items: [
      { label: '1. Install the Tools', source: 'docs/workflows/local-development/tools.md' },
      { label: '2. Open the Project', source: 'docs/workflows/local-development/repository.md' },
      { label: '3. Run in Docker', source: 'docs/workflows/local-development/setup.md' },
      { label: '4. Connect to the Database', source: 'docs/workflows/local-development/database.md' },
      { label: 'Daily Development', source: 'docs/workflows/local-development/README.md' },
      { label: 'Debug Locally', source: 'docs/workflows/local-development/debugging.md' },
    ],
  },
  {
    label: 'Frontend',
    items: [
      { label: 'Overview', source: 'docs/frontend/README.md' },
      {
        label: 'Pages',
        items: [
          { label: 'Overview', source: 'docs/frontend/pages/README.md' },
          { label: 'Composition', source: 'docs/frontend/pages/composition.md' },
          { label: 'Preferences', source: 'docs/frontend/pages/preferences.md' },
          { label: 'Testing', source: 'docs/frontend/pages/testing.md' },
          { label: 'Scaffolding', source: 'docs/frontend/pages/scaffolding.md' },
        ],
      },
      {
        label: 'Components',
        items: [
          { label: 'UI Basics', source: 'docs/frontend/components/README.md' },
          { label: 'Tables', source: 'docs/frontend/components/tables.md' },
          { label: 'Row Updates', source: 'docs/frontend/components/table-rows.md' },
          { label: 'Calendars', source: 'docs/frontend/components/calendars.md' },
          { label: 'Dashboards', source: 'docs/frontend/components/dashboards.md' },
          { label: 'Forms', source: 'docs/frontend/components/modals-and-forms.md' },
          { label: 'Overlays', source: 'docs/frontend/components/overlays.md' },
          { label: 'Message Overlays', source: 'docs/frontend/components/message-overlays.md' },
          { label: 'App Navigation', source: 'docs/frontend/components/navigation.md' },
        ],
      },
      {
        label: 'Architecture',
        items: [
          { label: 'Ownership', source: 'docs/frontend/architecture/ownership.md' },
          { label: 'State and Data', source: 'docs/frontend/architecture/state-and-data.md' },
        ],
      },
    ],
  },
  {
    label: 'Backend',
    items: [
      { label: 'Overview', source: 'docs/backend/README.md' },
      { label: 'Services', source: 'docs/backend/services.md' },
      { label: 'Authentication', source: 'docs/backend/auth.md' },
      { label: 'Authorization and Policies', source: 'docs/backend/authorization.md' },
      { label: 'Middleware', source: 'docs/backend/middleware.md' },
      { label: 'HTTP Flow', source: 'docs/backend/http.mmd' },
      { label: 'API Contracts', source: 'docs/backend/api.md' },
      { label: 'Reference Data', source: 'docs/backend/reference-data.md' },
      { label: 'Database', source: 'docs/backend/database.md' },
      { label: 'Errors', source: 'docs/backend/errors.md' },
      { label: 'Testing', source: 'docs/backend/testing.md' },
      { label: 'Google Sheets', source: 'docs/backend/integrations/google-sheets.md' },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { label: 'Overview', source: 'docs/workflows/delivery/README.md' },
      { label: 'Refresh Local Data', source: 'docs/workflows/delivery/refresh-data.md' },
      { label: 'Testing', source: 'docs/workflows/delivery/testing.md' },
      { label: 'Review and Merge Changes', source: 'docs/workflows/delivery/review-and-merge.md' },
      { label: 'Deploy, Verify, and Recover', source: 'docs/workflows/delivery/deployment.md' },
      { label: 'CI', source: 'docs/workflows/delivery/ci.md' },
      { label: 'Repository Reports', source: 'docs/workflows/delivery/reports.md' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Manual Access and Deployment', source: 'docs/workflows/admin/manual-deployment.md' },
    ],
  },
  {
    label: 'Production',
    items: [
      { label: 'Overview', source: 'docs/workflows/production/README.md' },
      { label: 'Configure Access', source: 'docs/workflows/production/access.md' },
      { label: 'Restore GitHub Authentication', source: 'docs/workflows/production/github-authentication.md' },
      { label: 'Restore Verification Email', source: 'docs/workflows/production/email-recovery.md' },
      { label: 'Inspect NGINX and TLS', source: 'docs/workflows/production/nginx-and-tls.md' },
    ],
  },
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
