import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { ProgramCycle } from '../../../../../common/types/cohort';

interface CycleTableProps {
  columns: TableColumnDef<ProgramCycle>[];
  cycles: ProgramCycle[];
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  selectedKey: string | null;
  onRowSelect: (cycle: ProgramCycle) => void;
}

export default function CycleTable(props: CycleTableProps) {
  return <Table
    ariaLabel="Cycles"
    columns={props.columns}
    data={props.cycles}
    loading={props.loading}
    unavailable={props.error ? { title: 'Cycles unavailable', onRetry: props.onRetry } : undefined}
    keyExtractor={cycle => cycle.id}
    selectedKey={props.selectedKey}
    onRowSelect={props.onRowSelect}
    emptyMessage="No cycles yet"
  />;
}
