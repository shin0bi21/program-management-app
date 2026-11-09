// Scope: verifies outreach field constraints and accessible controlled-select errors.
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { getDateOfBirthBounds } from '../youth/dateOfBirth';
import OutreachFormFields from './OutreachFormFields';
import type { OutreachFormValues } from './outreachFormSchema';

/**
 * Displays intake controls with an optional relationship error for accessibility examples.
 * @param props - Whether to supply the controlled field's validation message.
 * @example <TestForm showRelationshipError /> // associates the message with its trigger
 */
function TestForm({ showRelationshipError = false }: { showRelationshipError?: boolean }) {
  const { control, formState: { errors }, register, setError } = useForm<OutreachFormValues>();

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

    const input = screen.getByLabelText('Date of Birth *');
    const bounds = getDateOfBirthBounds();
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toBeRequired();
    expect(input).not.toHaveAttribute('min');
    expect(input).toHaveAttribute('max', bounds.max);
  });

  it('associates controlled select errors with the visible trigger', async () => {
    render(<TestForm showRelationshipError />);

    const error = await screen.findByRole('alert');
    const relationship = screen.getByRole('button', { name: 'Relationship' });

    expect(relationship).toHaveAttribute('aria-invalid', 'true');
    expect(relationship).toHaveAttribute('aria-describedby', error.id);
  });
});
