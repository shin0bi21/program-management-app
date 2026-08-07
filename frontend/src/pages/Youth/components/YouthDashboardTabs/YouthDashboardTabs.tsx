import './YouthDashboardTabs.css';

interface TabOption<T extends string> {
  value: T;
  label: string;
}

export default function YouthDashboardTabs<T extends string>({
  activeTab,
  ariaLabel,
  onChange,
  options,
}: {
  activeTab: T;
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
