import { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../../hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenuPanel/FloatingMenuPanel';
import './FloatingSelect.css';

export interface FloatingSelectOption {
  value: string;
  label: string;
}

interface FloatingSelectProps {
  id: string;
  value: string;
  options: FloatingSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  action?: {
    label: string;
    onSelect: () => void;
  };
}

export default function FloatingSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  ariaLabel,
  disabled = false,
  action,
}: FloatingSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerWidth = triggerRef.current?.getBoundingClientRect().width;
  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: triggerWidth ?? 240, heightEstimate: 260 },
  );
  const selected = options.find(option => option.value === value);

  const select = (nextValue: string) => {
    onChange(nextValue);
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="floating-select-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggle}
      >
        <span className={selected ? undefined : 'floating-select-placeholder'}>
          {selected?.label ?? placeholder}
        </span>
        <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" />
      </button>

      {position && (
        <FloatingMenuPanel
          menuRef={menuRef}
          position={position}
          onClose={close}
          className="floating-select-menu"
          width={triggerWidth}
        >
          {action && (
            <button
              type="button"
              role="menuitem"
              className="floating-select-action"
              onClick={() => {
                close();
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          )}
          <div className="floating-select-options">
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={option.value === value}
                className="floating-select-option"
                onClick={() => select(option.value)}
              >
                {option.label}
              </button>
            ))}
            {options.length === 0 && (
              <span className="floating-select-empty">No options available</span>
            )}
          </div>
        </FloatingMenuPanel>
      )}
    </>
  );
}
