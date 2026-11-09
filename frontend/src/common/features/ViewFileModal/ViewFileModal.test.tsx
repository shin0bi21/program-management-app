import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ViewFileModal from './ViewFileModal';

const panzoom = vi.hoisted(() => ({
  destroy: vi.fn(),
  reset: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  zoomWithWheel: vi.fn(),
}));

vi.mock('@panzoom/panzoom', () => ({
  default: vi.fn(() => panzoom),
}));

describe('ViewFileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:file-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('previews an image, provides zoom controls, downloads it, and releases resources', () => {
    const file = new Blob(['image'], { type: 'image/png' });
    const view = render(<ViewFileModal
      isOpen
      title="Workshop photo"
      file={file}
      mimeType="image/png"
      downloadName="workshop.png"
      onClose={vi.fn()}
    />);

    expect(screen.getByRole('img', { name: 'Workshop photo' })).toHaveAttribute('src', 'blob:file-preview');
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('download', 'workshop.png');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(panzoom.zoomIn).toHaveBeenCalledWith({ animate: true });
    expect(panzoom.zoomOut).toHaveBeenCalledWith({ animate: true });
    expect(panzoom.reset).toHaveBeenCalledWith({ animate: true });

    view.rerender(<ViewFileModal
      isOpen={false}
      title="Workshop photo"
      file={file}
      mimeType="image/png"
      onClose={vi.fn()}
    />);
    expect(panzoom.destroy).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-preview');
  });

  it('renders document previews and loading, error, and unsupported states', () => {
    const onDownload = vi.fn();
    const view = render(<ViewFileModal
      isOpen
      title="Report"
      file={new Blob(['pdf'], { type: 'application/pdf' })}
      mimeType="application/pdf"
      onClose={vi.fn()}
    />);
    expect(screen.getByTitle('Report preview')).toHaveAttribute('src', 'blob:file-preview');

    view.rerender(<ViewFileModal
      isOpen title="Report" file={null} mimeType="application/pdf" loading onClose={vi.fn()}
    />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading preview…');

    view.rerender(<ViewFileModal
      isOpen title="Report" file={null} mimeType="application/pdf" error="Preview unavailable" onClose={vi.fn()}
    />);
    expect(screen.getByRole('alert')).toHaveTextContent('Preview unavailable');

    view.rerender(<ViewFileModal
      isOpen title="Document" file={null} mimeType="application/msword" onDownload={onDownload} onClose={vi.fn()}
    />);
    expect(screen.getByText(/cannot be previewed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledOnce();
  });
});
