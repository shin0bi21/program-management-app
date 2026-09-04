// Scope: verifies outreach field constraints and accessible controlled-select errors.
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import OutreachFormFields from './OutreachFormFields';
import { outreachFormDefaultValues, type OutreachFormValues } from './outreachFormSchema';

function TestForm({ showRelationshipError = false }: { showRelationshipError?: boolean }) {
  const { control, formState: { errors }, register, setError } = useForm<OutreachFormValues>({
    defaultValues: outreachFormDefaultValues,
  });

  useEffect(() => {
    if (showRelationshipError) {
      setError('contactRelationship', { message: 'Relationship is required' });
    }
  }, [setError, showRelationshipError]);

  return (
    <form>
      <OutreachFormFields
        idPrefix="outreach"
        register={register}
        control={control}
        errors={errors}
      />
    </form>
  );
}

describe('OutreachFormFields', () => {
  it('exposes the supported program age range to browser validation', () => {
    render(<TestForm />);

    expect(screen.getByRole('spinbutton', { name: 'Age *' })).toHaveAttribute('min', '12');
    expect(screen.getByRole('spinbutton', { name: 'Age *' })).toHaveAttribute('max', '19');
  });

  it('associates controlled select errors with the visible trigger', async () => {
    render(<TestForm showRelationshipError />);

    const error = await screen.findByRole('alert');
    const relationship = screen.getByRole('button', { name: 'Relationship' });

    expect(relationship).toHaveAttribute('aria-invalid', 'true');
    expect(relationship).toHaveAttribute('aria-describedby', error.id);
  });
});
