import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ColumnVisibilityMenu from './ColumnVisibilityMenu';

const columns = [
  { key: 'name', header: 'Name', render: () => 'Name' },
  { key: 'status', header: 'Status', render: () => 'Status' },
  { key: 'actions', header: '', render: () => 'Actions', resizable: false },
];

describe('ColumnVisibilityMenu', () => {
  it('changes hideable data columns without exposing fixed action columns', () => {
    const onHiddenColumnKeysChange = vi.fn();
    render(<ColumnVisibilityMenu columns={columns} hiddenColumnKeys={[]} onHiddenColumnKeysChange={onHiddenColumnKeysChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Status' }));

    expect(onHiddenColumnKeysChange).toHaveBeenCalledWith(['status']);
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('does not allow the final visible data column to be hidden', () => {
    const onHiddenColumnKeysChange = vi.fn();
    render(<ColumnVisibilityMenu columns={columns} hiddenColumnKeys={['status']} onHiddenColumnKeysChange={onHiddenColumnKeysChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Name' })).toBeDisabled();
    expect(onHiddenColumnKeysChange).not.toHaveBeenCalled();
  });
});
