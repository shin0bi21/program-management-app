import { useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faChevronDown, faEye } from '@fortawesome/free-solid-svg-icons';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import Button from '../Button/Button';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';
import './ViewMenu.css';

export interface ViewMenuOption<T extends string> {
  value: T;
  label: string;
}

interface ViewMenuProps<T extends string> {
  options: ViewMenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
}

/**
 * Lets the user choose a view and closes the popup after selection.
 * Selection is controlled: onChange requests a view, and the caller updates value.
 * @param props.options - Available views, such as Table and Calendar.
 * @example Choosing Calendar calls onChange('calendar') and closes the view menu.
 */
export default function ViewMenu<T extends string>({
  options,
  value,
  onChange,
  label = 'View',
}: ViewMenuProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
    triggerRef,
    { side: 'bottom', align: 'end' },
    { widthEstimate: 180, heightEstimate: options.length * 40 + 12 },
  );
  const selected = options.find(option => option.value === value);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        className="view-menu-trigger"
        aria-label={`${label}: ${selected?.label ?? value}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <FontAwesomeIcon icon={faEye} />
        <span className="view-menu-trigger__label">{label}</span>
        <FontAwesomeIcon icon={faChevronDown} className="view-menu-trigger__chevron" />
      </Button>
      {position && (
        <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close} className="view-menu" width={180}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className="view-menu-option"
              onClick={() => {
                onChange(option.value);
                close();
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <FontAwesomeIcon icon={faCheck} />}
            </button>
          ))}
        </FloatingMenuPanel>
      )}
    </>
  );
}
