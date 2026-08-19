import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import OutreachFormFields from './OutreachFormFields';
import { outreachFormDefaultValues, type OutreachFormValues } from './outreachFormSchema';

function TestForm() {
  const { control, formState: { errors }, register } = useForm<OutreachFormValues>({
    defaultValues: outreachFormDefaultValues,
  });

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
});
