// Scope: verifies labels and accessible field-error association for owned controls.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FloatingSelect from '../FloatingSelect/FloatingSelect';
import FormField from './FormField';

describe('FormField', () => {
  it('associates an input with its alert error without replacing existing descriptions', () => {
    render(
      <FormField id="name" label="Name" error="Name is required">
        <input id="name" aria-describedby="name-help" />
      </FormField>,
    );

    const input = screen.getByLabelText('Name');
    const error = screen.getByRole('alert');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', `name-help ${error.id}`);
    expect(error).toHaveTextContent('Name is required');
  });

  it('forwards error semantics to a shared floating select trigger', () => {
    render(
      <FormField id="role" label="Role" error="Role is required">
        <FloatingSelect
          id="role"
          value=""
          options={[]}
          onChange={() => undefined}
        />
      </FormField>,
    );

    const trigger = screen.getByRole('button', { name: 'Role' });
    const error = screen.getByRole('alert');

    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', error.id);
  });
});
