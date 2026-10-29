import './YouthDashboardTabs.css';

interface TabOption<T extends string> {
  value: T;
  label: string;
}

export default function YouthDashboardTabs<T extends string>({
  activeTab,
  disabled = false,
  ariaLabel,
  onChange,
  options,
}: {
  activeTab: T;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (tab: T) => void;
  options: ReadonlyArray<TabOption<T>>;
}) {
  return (
    <div className="youth-dashboard-tabs" role="group" aria-label={ariaLabel}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          className={activeTab === option.value ? 'is-active' : ''}
          aria-pressed={activeTab === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
