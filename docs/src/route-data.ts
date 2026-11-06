import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';

/**
 * Formats generated folder labels before Starlight renders each page.
 * Page labels, navigation order, and URLs remain owned by the generated sidebar.
 * @example The local-development group renders as Local Development.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  route.sidebar = formatSidebarGroups(route.sidebar);
});

/**
 * Returns a sidebar with readable folder names without mutating shared route data.
 * Preserves the GitHub product name and leaves authored page labels unchanged.
 * @example common-issues becomes Common Issues, and github becomes GitHub.
 */
function formatSidebarGroups(entries: StarlightRouteData['sidebar']): StarlightRouteData['sidebar'] {
  return entries.map((entry) => {
    if (entry.type === 'link') return entry;

    const label = entry.label.replace(/[-_]+/g, ' ').replace(/\b\w+/g, (word) => {
      if (word.toLowerCase() === 'github') return 'GitHub';
      return word[0].toUpperCase() + word.slice(1);
    });

    return { ...entry, label, entries: formatSidebarGroups(entry.entries) };
  });
}
