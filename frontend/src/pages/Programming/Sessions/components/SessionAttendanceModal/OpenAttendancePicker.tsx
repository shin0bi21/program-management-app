import Button from '../../../../../common/components/Button/Button';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';
import type { AttendanceYouth } from '../../types';

interface OpenAttendancePickerProps {
  search: string;
  appliedSearch: string;
  searchResults: AttendanceYouth[];
  searching: boolean;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onSearchApply: () => void;
  onSearchClear: () => void;
  onCheckIn: (profile: AttendanceYouth) => void;
}

export default function OpenAttendancePicker({
  search,
  appliedSearch,
  searchResults,
  searching,
  disabled,
  onSearchChange,
  onSearchApply,
  onSearchClear,
  onCheckIn,
}: OpenAttendancePickerProps) {
  const showResults = appliedSearch.length >= 2;

  return (
    <div className="open-attendance-picker">
      <div className="open-attendance-picker__controls">
        <SearchInput
          label="Find youth profile"
          value={search}
          appliedValue={appliedSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          onApply={onSearchApply}
          onClear={onSearchClear}
          placeholder="Search youth profiles"
          disabled={disabled}
        />
      </div>

      {showResults && (
        <div className="open-attendance-results" aria-label="Youth profile results">
          {searching && <p className="page-empty">Searching…</p>}
          {!searching && !searchResults.length && (
            <p className="page-empty">No matching profiles.</p>
          )}
          {!searching && searchResults.map(profile => (
            <div className="open-attendance-results__row" key={profile.id}>
              <span>{profile.firstName} {profile.lastName}</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onCheckIn(profile)}
                disabled={disabled}
              >
                Check in
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
