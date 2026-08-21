import Table from '../../../../../common/components/Table/Table';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { Program } from '../../../../../common/features/programs/types';

interface ProgramTableProps {
  columns: TableColumnDef<Program>[];
  programs: Program[];
  loading: boolean;
  error?: string;
  selectedKey: string | null;
  onRowSelect: (program: Program) => void;
}

export default function ProgramTable(props: ProgramTableProps) {
  return <Table
    ariaLabel="Programs"
    columns={props.columns}
    data={props.programs}
    loading={props.loading}
    error={props.error}
    keyExtractor={program => program.id}
    selectedKey={props.selectedKey}
    onRowSelect={props.onRowSelect}
    emptyMessage="No programs yet"
  />;
}
