import Button from '../../../../../common/components/Button/Button';
import SearchInput from '../../../../../common/components/SearchInput/SearchInput';
import type { YouthProfile } from '../../../../../common/types/youth';

interface OpenAttendancePickerProps {
  search: string;
  searchResults: YouthProfile[];
  searching: boolean;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onCreateProfile: () => void;
  onCheckIn: (profile: YouthProfile) => void;
}

export default function OpenAttendancePicker({
  search,
  searchResults,
  searching,
  disabled,
  onSearchChange,
  onCreateProfile,
  onCheckIn,
}: OpenAttendancePickerProps) {
  const showResults = search.trim().length >= 2;

  return (
    <div className="open-attendance-picker">
      <div className="open-attendance-picker__controls">
        <SearchInput
          label="Find youth profile"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search youth profiles"
          disabled={disabled}
        />
        <Button variant="secondary" onClick={onCreateProfile} disabled={disabled}>
          + Create Profile
        </Button>
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
