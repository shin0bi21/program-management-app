import { useRef, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import SelectOptions from './SelectOptions';
import './FloatingSelect.css';

export interface FloatingSelectOption {
  id: string;
  label: string;
  className?: string;
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
  options: readonly FloatingSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true';
  disabled?: boolean;
  search?: boolean;
  className?: string;
  action?: {
    label: string;
    onSelect: () => void;
  };
  optionActions?: (option: FloatingSelectOption) => FloatingSelectOptionAction[];
}

/**
 * Displays a controlled single-choice field with an optional searchable popup.
 * @param props.id - Connects the button to its form label.
 * @param props.value - Selected option ID; the placeholder appears when no option matches.
 * @param props.options - Available choices with unique IDs and display labels, such as programs or staff members.
 * @param props.onChange - Receives the chosen ID before the popup closes; update value to display it.
 * @param props.search - Adds a field to find an existing option; typing alone does not select it.
 * @param props.action - Optional action above the choices; closes the popup before invoking onSelect.
 * @param props.optionActions - Extra actions for an option, such as Edit or Delete.
 * @example <FloatingSelect id="program" value={programId} options={programOptions} onChange={setProgramId} search />
 */
export default function FloatingSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  disabled = false,
  search = false,
  className,
  action,
  optionActions,
}: FloatingSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const triggerWidth = triggerRef.current?.getBoundingClientRect().width;
  const { isOpen, open, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'start' },
    { widthEstimate: triggerWidth ?? 240, heightEstimate: 260 },
  );
  const selected = options.find(option => option.id === value);
  const fieldLabel = Array.from(triggerRef.current?.labels ?? [])
    .map(item => item.textContent)
    .join(' ');
  const label = ariaLabel ?? (fieldLabel || placeholder);

  /**
   * Reports the chosen option ID and dismisses this popup session.
   * @param nextValue - ID of the option chosen from the displayed choices.
   * @example select('program-1') calls onChange('program-1') before closing.
   */
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
        className={`floating-select-trigger${className ? ` ${className}` : ''}`}
        aria-haspopup={search ? 'dialog' : 'menu'}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={event => {
          if (search && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            open();
          }
        }}
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
          keyboardMode={search ? 'form' : 'menu'}
          ariaLabel={search ? label : undefined}
        >
          {search ? (
            <SelectOptions
              id={id}
              label={label}
              value={value}
              options={options}
              onSelect={select}
              onClose={close}
              action={action}
              optionActions={optionActions}
              aria-describedby={ariaDescribedBy}
              aria-invalid={ariaInvalid}
            />
          ) : (
            <>
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
                  <div className="floating-select-option-row" key={option.id}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={option.id === value}
                      className={`floating-select-option${option.className ? ` ${option.className}` : ''}`}
                      onClick={() => select(option.id)}
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
            </>
          )}
        </FloatingMenuPanel>
      )}
    </>
  );
}
