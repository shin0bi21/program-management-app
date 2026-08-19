import { useState } from 'react';

import { useAuth } from '../../../../../auth/authContext';
import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import { usePrograms } from '../../hooks/usePrograms';
import type { Program } from '../../types';
import AddProgramModal from './AddProgramModal/AddProgramModal';

interface ProgramSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'false' | 'true';
}

export default function ProgramSelect({
  id,
  value,
  onChange,
  disabled = false,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}: ProgramSelectProps) {
  const { permissions } = useAuth();
  const { programs, upsertProgram, loading, error: programsError } = usePrograms();
  const [addOpen, setAddOpen] = useState(false);
  const handleCreated = (program: Program) => {
    upsertProgram(program);
    onChange(program.id);
  };

  return <>
    <FloatingSelect
      id={id}
      value={value}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      options={programs.map(program => ({ value: program.id, label: program.name }))}
      onChange={onChange}
      placeholder={loading ? 'Loading programs...' : 'Select a program'}
      disabled={disabled || loading}
      action={permissions.includes('write:programs') ? { label: '+ Add program', onSelect: () => setAddOpen(true) } : undefined}
    />
    <AddProgramModal
      isOpen={addOpen}
      programsError={programsError}
      onClose={() => setAddOpen(false)}
      onCreated={handleCreated}
    />
  </>;
}
