import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import './Checklist.css';

interface ChecklistProps {
  options: readonly { value: string; label: string }[];
  value: readonly string[];
  onToggle: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  inMenu?: boolean;
}

export default function Checklist({ options, value, onToggle, ariaLabel, disabled = false, inMenu = false }: ChecklistProps) {
  return <div className="checklist" role="group" aria-label={ariaLabel}>
    {options.map(option => {
      const checked = value.includes(option.value);
      const content = <>
        <span aria-hidden="true" className={`checklist-indicator${checked ? ' checked' : ''}`}>
          {checked && <FontAwesomeIcon icon={faCheck} />}
        </span>
        <span>{option.label}</span>
      </>;

      return inMenu ? <button
        key={option.value} type="button" role="menuitemcheckbox" aria-checked={checked}
        className="checklist-option" disabled={disabled} onClick={() => onToggle(option.value)}
      >{content}</button> : <label key={option.value} className={`checklist-option${disabled ? ' disabled' : ''}`}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(option.value)} />
        {content}
      </label>;
    })}
  </div>;
}
