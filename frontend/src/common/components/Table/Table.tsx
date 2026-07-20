import { ReactNode, memo } from 'react';
import './Table.css';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
  className?: string;
}

interface TableRowProps<T> {
  item: T;
  columns: TableColumn<T>[];
}

function TableRowComponent<T>({ item, columns }: TableRowProps<T>) {
  return (
    <tr>
      {columns.map((column) => (
        <td key={column.key} className={column.className}>{column.render(item)}</td>
      ))}
    </tr>
  );
}

// Cast preserves the generic signature through React.memo
const TableRow = memo(TableRowComponent) as typeof TableRowComponent;

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
  maxHeight?: string;
}

export default function Table<T>({
  columns,
  data,
  loading = false,
  error,
  emptyMessage = 'No rows found',
  keyExtractor,
  maxHeight = '600px',
}: TableProps<T>) {
  if (loading) {
    return <div className="table-loading">Loading...</div>;
  }

  if (error) {
    return <div className="table-error">{error}</div>;
  }

  return (
    <div className="table-wrapper" style={{ maxHeight }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.className}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr className="table-empty-row">
              <td colSpan={columns.length} className="table-empty-cell">{emptyMessage}</td>
            </tr>
          ) : (
            data.map((item) => (
              <TableRow key={keyExtractor(item)} item={item} columns={columns} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
