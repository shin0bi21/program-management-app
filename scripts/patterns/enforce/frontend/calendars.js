export function checkTimelineCalendars(violations, file, source) {
  const timelineCalendarPage = file.startsWith('frontend/src/pages/')
    && file.endsWith('.tsx')
    && !/\.(?:test|spec|story)\.tsx$/.test(file)
    && source.includes('<TimelineCalendar');
  if (!timelineCalendarPage) return;

  if (!source.includes('useDataBuffer')) {
    violations.push(
      `${file}:1 timeline-calendar pages must load visible ranges through useDataBuffer.`,
    );
  }

  const calendarOwner = /\/components\/[^/]*Calendar\/[^/]*Calendar\.tsx$/.test(file);
  if (!calendarOwner) {
    violations.push(
      `${file}:1 TimelineCalendar must be owned by a cohesive page-private *Calendar component.`,
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
      `${file}:1 buffered timeline calendars must wire the complete period lifecycle; missing ${missing.join(', ')}.`,
    );
  }
}

export function checkCalendarDataHooks(violations, file) {
  const calendarDataHook = file.startsWith('frontend/src/pages/')
    && /\/use[^/]*CalendarData\.tsx?$/.test(file)
    && !/\.(?:test|spec)\.tsx?$/.test(file);
  if (!calendarDataHook) return;

  const calendarHook = /\/components\/[^/]*Calendar\/hooks\/use[^/]*CalendarData\.tsx?$/.test(file);
  if (!calendarHook) {
    violations.push(
      `${file}:1 calendar-data hooks must be owned by their page-private *Calendar hooks directory.`,
    );
  }
}
