import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { Program } from '../../../../../common/features/programs/types';

interface ProgramTableProps {
  columns: TableColumnDef<Program>[];
  programs: Program[];
  loading: boolean;
  error?: string;
  onRetry?: () => void;
}

export default function ProgramTable(props: ProgramTableProps) {
  return <Table
    ariaLabel="Programs"
    columns={props.columns}
    data={props.programs}
    loading={props.loading}
    unavailable={props.error ? { title: 'Programs unavailable', onRetry: props.onRetry } : undefined}
    keyExtractor={program => program.id}
    emptyMessage="No programs yet"
  />;
}
