import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import FilterCard, { type FilterCardCategory } from '../../../common/components/FilterCard/FilterCard';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
import ResourceCalendar from '../../../common/components/ResourceCalendar/ResourceCalendar';
import type { BuildItemContext, CalendarCellContext, ItemDropContext } from '../../../common/components/ResourceCalendar/types';
import type { PeriodRange } from '../../../common/components/ResourceCalendar/PeriodDataBuffer';
import TimeItem from './components/TimeItem/TimeItem';
import TimeEntryModal from './components/TimeEntryModal/TimeEntryModal';
import { useTimesheetBuffer } from './hooks/useTimesheetBuffer';
import { useItemMutationQueue } from './hooks/useItemMutationQueue';
import { useFilteredTimesheetData } from './hooks/useFilteredTimesheetData';
import type { StaffResource, TimeEntryProgram, TimesheetItem } from './types';
import { createTimeEntry, deleteTimeEntry, getTimeEntries, updateTimeEntry, type SetTimeEntryInput } from './api/timeEntries.api';
import { TIME_ENTRY_TASK_OPTIONS } from './timeEntryOptions';
import './Timesheets.css';

const initialDate = new Date();
type EntryTarget = { resourceId: string; date: string; item: TimesheetItem };

const getStaffResourceId = (resource: StaffResource) => resource.id;
const getTimesheetItemId = (item: TimesheetItem) => item.id;
const canDropWithinStaff = ({ source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => (
  source.resource.id === destination.resource.id
);
const summarizeOverflow = ({ items, itemCount }: { items: readonly TimesheetItem[]; itemCount: number }) => (
  `${itemCount} ${itemCount === 1 ? 'Entry' : 'Entries'} - ${items.reduce((total, item) => total + item.hours, 0)} Hours`
);

export default function Timesheets() {
  const { permissions } = useAuth();
  const canWriteTimesheets = permissions.includes('write:timesheets');
  const [resources, setResources] = useState<StaffResource[]>([]);
  const [programs, setPrograms] = useState<TimeEntryProgram[]>([]);
  const [staffFilters, setStaffFilters] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [programFilters, setProgramFilters] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{ resourceId?: string; date?: string }>({});
  const [editTarget, setEditTarget] = useState<EntryTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: () => setConfirmAction(null) });
  const { enqueue, isLatest } = useItemMutationQueue();
  const confirmedMoveSourcesRef = useRef(new Map<string, EntryTarget>());
  const loadRange = useCallback(async ({ start, end }: PeriodRange) => {
    const response = await getTimeEntries(start.key, end.key);
    setResources(current => {
      const unchanged = current.length === response.resources.length
        && current.every((resource, index) => resource.id === response.resources[index]?.id
          && resource.name === response.resources[index]?.name
          && resource.role === response.resources[index]?.role);
      return unchanged ? current : response.resources;
    });
    setPrograms(current => {
      const unchanged = current.length === response.programs.length
        && current.every((program, index) => program.id === response.programs[index]?.id
          && program.name === response.programs[index]?.name);
      return unchanged ? current : response.programs;
    });
    return response.data;
  }, []);
  const { data, error, upsertItem, removeItem, initialize, reset, onPeriodsBuilt, retry } = useTimesheetBuffer({
    load: loadRange,
  });
  const filterCategories = useMemo<FilterCardCategory[]>(() => [
    {
      id: 'staff',
      label: 'Staff',
      options: resources.map(resource => ({ value: resource.id, label: resource.name })),
    },
    {
      id: 'program',
      label: 'Program',
      options: [{ value: 'general', label: 'General' }, ...programs.map(program => ({ value: program.id, label: program.name }))],
    },
    {
      id: 'entryType',
      label: 'Task',
      options: TIME_ENTRY_TASK_OPTIONS,
    },
  ], [programs, resources]);
  const visibleResources = useMemo(() => staffFilters.length
    ? resources.filter(resource => staffFilters.includes(resource.id))
    : resources, [resources, staffFilters]);
  const visibleData = useFilteredTimesheetData(data, typeFilters, programFilters);

  const applyFilter = (categoryId: string, values: string[]) => {
    if (categoryId === 'staff') setStaffFilters(values);
    if (categoryId === 'entryType') setTypeFilters(values);
    if (categoryId === 'program') setProgramFilters(values);
  };

  const addTimeEntry = async (input: SetTimeEntryInput) => {
    const created = editTarget
      ? await updateTimeEntry(editTarget.item.id, input)
      : await createTimeEntry(input);
    const label = TIME_ENTRY_TASK_OPTIONS.find(option => option.value === created.task)?.label ?? created.task;
    upsertItem(created.staffId, created.workDate, { ...created, label });
  };

  const requestDelete = useCallback((target: EntryTarget) => {
    setConfirmAction({
      title: 'Delete time entry',
      message: `Delete this ${target.item.label.toLowerCase()} entry?`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        await deleteTimeEntry(target.item.id);
        removeItem(target.item.id);
        setEditTarget(current => current?.item.id === target.item.id ? null : current);
      },
    });
  }, [removeItem]);

  const moveTimeEntry = async ({ item, source, destination }: ItemDropContext<StaffResource, TimesheetItem>) => {
    setMoveError(null);
    const sourceResourceId = source.resource.id;
    const destinationResourceId = destination.resource.id;
    upsertItem(destinationResourceId, destination.period.key, item);
    const queuedMutation = enqueue(item.id, () => updateTimeEntry(item.id, {
      staffId: destinationResourceId,
      programId: item.programId,
      cohortId: item.cohortId,
      task: item.task,
      workDate: destination.period.key,
      hours: item.hours,
      note: item.note,
    }));
    if (!queuedMutation.hadPending) {
      confirmedMoveSourcesRef.current.set(item.id, {
        resourceId: sourceResourceId,
        date: source.period.key,
        item,
      });
    }
    try {
      const updated = await queuedMutation.result;
      const label = TIME_ENTRY_TASK_OPTIONS.find(option => option.value === updated.task)?.label ?? updated.task;
      confirmedMoveSourcesRef.current.set(item.id, {
        resourceId: destinationResourceId,
        date: destination.period.key,
        item: { ...updated, label },
      });
      if (!isLatest(item.id, queuedMutation.revision)) return;
      upsertItem(destinationResourceId, destination.period.key, { ...updated, label });
      confirmedMoveSourcesRef.current.delete(item.id);
    } catch {
      if (!isLatest(item.id, queuedMutation.revision)) return;
      const confirmed = confirmedMoveSourcesRef.current.get(item.id);
      if (confirmed) upsertItem(confirmed.resourceId, confirmed.date, confirmed.item);
      confirmedMoveSourcesRef.current.delete(item.id);
      setMoveError('Unable to move time entry. The entry was returned to its original day.');
    }
  };

  const renderTimeItem = useCallback((
    resource: StaffResource,
    date: string,
    item: TimesheetItem,
    closeOverflow?: () => void,
  ) => (
    <TimeItem
      item={item}
      onEdit={canWriteTimesheets ? () => {
        closeOverflow?.();
        setEditTarget({ resourceId: resource.id, date, item });
        setAddTarget({ resourceId: resource.id, date });
        setAddOpen(true);
      } : undefined}
      onDelete={canWriteTimesheets ? () => {
        closeOverflow?.();
        requestDelete({ resourceId: resource.id, date, item });
      } : undefined}
    />
  ), [canWriteTimesheets, requestDelete]);
  const renderCalendarResource = useCallback(({ resource }: { resource: StaffResource }) => (
    <div className="timesheets-resource">{resource.name}</div>
  ), []);
  const buildCalendarItem = useCallback(({ resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>) => (
    renderTimeItem(resource, period.key, item)
  ), [renderTimeItem]);
  const buildOverflowItem = useCallback((
    { resource, period, data: item }: BuildItemContext<StaffResource, TimesheetItem>,
    { close }: { close: () => void },
  ) => renderTimeItem(resource, period.key, item, close), [renderTimeItem]);
  const openCellEntry = useCallback(({ resource, period }: CalendarCellContext<StaffResource, TimesheetItem>) => {
    setAddTarget({ resourceId: resource.id, date: period.key });
    setEditTarget(null);
    setAddOpen(true);
  }, []);

  return (
    <>
      <main className="page-container page-container--data timesheets-page">
        <PageHeader
          title="Timesheets"
          actions={canWriteTimesheets
            ? <Button onClick={() => { setEditTarget(null); setAddTarget({}); setAddOpen(true); }}>+ Add</Button>
            : undefined}
          filters={(
            <FilterCard
              categories={filterCategories}
              values={{ staff: staffFilters, entryType: typeFilters, program: programFilters }}
              onApply={applyFilter}
              onClearAll={() => { setStaffFilters([]); setTypeFilters([]); setProgramFilters([]); }}
            />
          )}
        />
        {(error || moveError) && (
          <div className="timesheets-page__error" role="alert">
            <span>{moveError ?? error}</span>
            {error && <Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}
          </div>
        )}
        <div className="timesheets-page__calendar">
          <ResourceCalendar
            resources={visibleResources}
            data={visibleData}
            initialDate={initialDate}
            ariaLabel="Staff timesheet calendar"
            resourceHeader="Staff member"
            onPeriodsBuilt={onPeriodsBuilt}
            onInitialPeriods={initialize}
            onPeriodsReset={reset}
            onItemDrop={canWriteTimesheets ? moveTimeEntry : undefined}
            canDropItem={canDropWithinStaff}
            maxVisibleItemsPerCell={2}
            renderOverflowSummary={summarizeOverflow}
            onCellClick={canWriteTimesheets ? openCellEntry : undefined}
            getResourceId={getStaffResourceId}
            getItemId={getTimesheetItemId}
            renderResource={renderCalendarResource}
            buildItem={buildCalendarItem}
            buildOverflowItem={buildOverflowItem}
          />
        </div>
      </main>
      <TimeEntryModal
        isOpen={addOpen}
        resources={resources}
        programs={programs}
        onClose={() => setAddOpen(false)}
        onAdd={addTimeEntry}
        initialResourceId={addTarget.resourceId}
        initialDate={addTarget.date}
        initialItem={editTarget?.item}
      />
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        successDelay={confirmModal.successDelay}
      >
        <p>{confirmAction?.message}</p>
      </Modal>
    </>
  );
}
