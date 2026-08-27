// Owns FullCalendar configuration, responsive view changes, and domain event callbacks.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventInput } from '@fullcalendar/react';
import ProgrammingCalendar from './ProgrammingCalendar';

const calendarState = vi.hoisted(() => ({
  changeView: vi.fn(),
  props: null as null | {
    initialView: string;
    headerToolbar: { end: string };
    dayMaxEvents: number;
    eventContent: (info: {
      event: {
        id: string;
        title: string;
        start: Date;
        end: Date;
        extendedProps: Record<string, unknown>;
      };
    }) => React.ReactNode;
    events: EventInput[];
  },
}));

vi.mock('@fullcalendar/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: React.forwardRef(function MockFullCalendar(props: NonNullable<typeof calendarState.props>, ref) {
      calendarState.props = props;
      React.useImperativeHandle(ref, () => ({ getApi: () => ({ changeView: calendarState.changeView }) }));
      return <div data-testid="full-calendar">
        {props.events.map(event => <div key={String(event.id)}>
          {props.eventContent({
            event: {
              id: String(event.id),
              title: String(event.title),
              start: new Date(String(event.start)),
              end: new Date(String(event.end)),
              extendedProps: event.extendedProps ?? {},
            },
          })}
        </div>)}
      </div>;
    }),
  };
});

const event: EventInput = {
  id: 'session-1',
  title: 'Communication',
  start: '2026-07-07T21:00:00.000Z',
  end: '2026-07-07T23:30:00.000Z',
  extendedProps: { programName: 'Soft Skills', sessionTypeName: 'Guest Speaker' },
};

describe('ProgrammingCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarState.props = null;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024, writable: true });
  });

  it('owns desktop calendar configuration and event interactions', () => {
    const onEventSelect = vi.fn();
    const onEventEdit = vi.fn();
    const onEventDelete = vi.fn();
    render(
      <ProgrammingCalendar
        events={[event]}
        onEventSelect={onEventSelect}
        onEventEdit={onEventEdit}
        onEventDelete={onEventDelete}
      />,
    );

    expect(calendarState.props?.initialView).toBe('dayGridMonth');
    expect(calendarState.props?.headerToolbar.end).toBe(
      'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
    );
    expect(calendarState.props?.dayMaxEvents).toBe(1);
    expect(screen.getByRole('button', {
      name: 'Soft Skills, Communication, Guest Speaker, 5pm – 7:30pm',
    })).toBeInTheDocument();
    expect(screen.getByText('Guest Speaker')).toHaveClass(
      'session-type-badge--guest-speaker',
    );

    fireEvent.click(screen.getByRole('button', { name: /Soft Skills, Communication/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Communication' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Communication' }));
    expect(onEventSelect).toHaveBeenCalledWith('session-1');
    expect(onEventEdit).toHaveBeenCalledWith('session-1');
    expect(onEventDelete).toHaveBeenCalledWith('session-1');
  });

  it('limits small screens to day and list views', () => {
    window.innerWidth = 390;
    render(<ProgrammingCalendar />);

    expect(calendarState.props?.initialView).toBe('timeGridDay');
    expect(calendarState.props?.headerToolbar.end).toBe('timeGridDay,listMonth');
  });

  it('changes the mounted calendar view when the viewport crosses the breakpoint', () => {
    render(<ProgrammingCalendar />);

    window.innerWidth = 390;
    fireEvent(window, new Event('resize'));

    expect(calendarState.changeView).toHaveBeenLastCalledWith('timeGridDay');
  });
});
