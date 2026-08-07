import { useRef, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import './FloatingSelect.css';

export interface FloatingSelectOption {
  value: string;
  label: string;
}

export interface FloatingSelectOptionAction {
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'danger';
  onSelect: () => void;
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
  optionActions?: (option: FloatingSelectOption) => FloatingSelectOptionAction[];
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
  optionActions,
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
              <div className="floating-select-option-row" key={option.value}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === value}
                  className="floating-select-option"
                  onClick={() => select(option.value)}
                >
                  {option.label}
                </button>
                {optionActions?.(option).map(optionAction => (
                  <button
                    key={optionAction.label}
                    type="button"
                    role="menuitem"
                    aria-label={`${optionAction.label} ${option.label}`}
                    className={`floating-select-option-action${optionAction.variant === 'danger' ? ' floating-select-option-action--danger' : ''}`}
                    onClick={() => {
                      close();
                      optionAction.onSelect();
                    }}
                  >
                    {optionAction.icon ?? optionAction.label}
                  </button>
                ))}
              </div>
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
