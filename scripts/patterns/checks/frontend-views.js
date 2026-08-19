export function checkPaginatedTables(violations, file, source) {
  if (!file.startsWith('frontend/src/pages/')) return;

  const usesInfiniteList = source.includes('useInfiniteListQuery');
  if (usesInfiniteList && !file.includes('/hooks/')) {
    violations.push(
      `${file}:1 page components must own remote infinite-list queries through a page hook.`,
    );
  }

  const listViewHook = /\/components\/[^/]*ListView\/hooks\//.test(file);
  if (usesInfiniteList && file.includes('ListView/') && !listViewHook) {
    violations.push(
      `${file}:1 a *ListView remote-list hook must be colocated under that view's hooks directory.`,
    );
  }

  if (usesInfiniteList && !/limit\s*:\s*25\b/.test(source)) {
    violations.push(
      `${file}:1 remote list hooks must request the standard 25-row cursor page size.`,
    );
  }

  const paginationProps = ['hasNextPage', 'loadingNextPage', 'onLoadNextPage'];
  const wiredProps = paginationProps.filter(
    prop => new RegExp(`\\b${prop}\\s*=`).test(source),
  );
  if (wiredProps.length > 0 && wiredProps.length < paginationProps.length) {
    const missing = paginationProps.filter(prop => !wiredProps.includes(prop));
    violations.push(
      `${file}:1 paginated tables must wire the complete load-more contract; missing ${missing.join(', ')}.`,
    );
  }
}

export function checkResourceCalendars(violations, file, source) {
  const resourceCalendarPage = file.startsWith('frontend/src/pages/')
    && file.endsWith('.tsx')
    && !/\.(?:test|spec|story)\.tsx$/.test(file)
    && source.includes('<ResourceCalendar');
  if (!resourceCalendarPage) return;

  if (!source.includes('usePeriodDataBuffer')) {
    violations.push(
      `${file}:1 resource-calendar pages must load visible ranges through usePeriodDataBuffer.`,
    );
  }

  const calendarViewOwner = /\/components\/[^/]*CalendarView\/[^/]*CalendarView\.tsx$/.test(file);
  if (!calendarViewOwner) {
    violations.push(
      `${file}:1 ResourceCalendar must be owned by a cohesive page-private *CalendarView component.`,
    );
  }

  const lifecycleProps = [
    'onInitialPeriods',
    'onPeriodsBuilt',
    'onPeriodsReset',
    'positionStorageKey',
  ];
  const missing = lifecycleProps.filter(
    prop => !new RegExp(`\\b${prop}\\s*=`).test(source),
  );
  if (missing.length) {
    violations.push(
      `${file}:1 buffered resource calendars must wire the complete period lifecycle; missing ${missing.join(', ')}.`,
    );
  }
}

export function checkCalendarDataHooks(violations, file) {
  const calendarDataHook = file.startsWith('frontend/src/pages/')
    && /\/use[^/]*CalendarData\.tsx?$/.test(file)
    && !/\.(?:test|spec)\.tsx?$/.test(file);
  if (!calendarDataHook) return;

  const calendarViewHook = /\/components\/[^/]*CalendarView\/hooks\/use[^/]*CalendarData\.tsx?$/.test(file);
  if (!calendarViewHook) {
    violations.push(
      `${file}:1 calendar-data hooks must be owned by their page-private *CalendarView hooks directory.`,
    );
  }
}
