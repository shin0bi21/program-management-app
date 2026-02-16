import { ReactNode } from 'react';
import './Table.css';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  width?: string;
}

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
  emptyMessage = 'No data found',
  keyExtractor,
  maxHeight = '600px',
}: TableProps<T>) {
  if (loading) {
    return <div className="table-loading">Loading...</div>;
  }

  if (error) {
    return <div className="table-error">{error}</div>;
  }

  if (data.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrapper" style={{ maxHeight }}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={keyExtractor(item)}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
