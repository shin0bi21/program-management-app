// Owns PublicTopBar navigation, authentication links, and active-section presentation.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicTopBar from './PublicTopBar';

const auth = vi.hoisted(() => ({ isAuthenticated: false }));

vi.mock('../../../../../auth/authContext', () => ({
  useAuth: () => auth,
}));

function renderTopBar(initialPath = '/') {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<PublicTopBar />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/settings/account" element={<div>Account page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicTopBar', () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
    vi.restoreAllMocks();
  });

  it('scrolls the existing homepage route back to the hero', async () => {
    const user = userEvent.setup();
    const hero = document.createElement('section');
    hero.id = 'home';
    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({ top: -400 } as DOMRect);
    document.body.appendChild(hero);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    renderTopBar();
    await user.click(screen.getByRole('link', { name: 'Be Original Youth Group' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' });
    hero.remove();
  });

  it('takes signed-out visitors to Login', async () => {
    const user = userEvent.setup();
    renderTopBar();

    const link = screen.getByRole('link', { name: 'Login' });
    expect(link).toHaveAttribute('href', '/login');
    await user.click(link);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('takes authenticated visitors to My Account', async () => {
    auth.isAuthenticated = true;
    const user = userEvent.setup();
    renderTopBar();

    const link = screen.getByRole('link', { name: 'My Account' });
    expect(link).toHaveAttribute('href', '/settings/account');
    await user.click(link);
    expect(screen.getByText('Account page')).toBeInTheDocument();
  });

  it('highlights only the section represented by the current URL', async () => {
    const user = userEvent.setup();
    renderTopBar('/sign-up');

    const desktopSignUp = screen.getByRole('link', { name: 'Sign Up' });
    expect(desktopSignUp).toHaveClass('topbar-link--active');
    expect(desktopSignUp).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Programming' })).not.toHaveAttribute('aria-current');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const mobileSignUp = screen.getByRole('menuitem', { name: 'Sign Up' });
    expect(mobileSignUp).toHaveClass('topbar-mobile-link--active');
    expect(mobileSignUp).toHaveAttribute('aria-current', 'page');
  });

  it('leaves section links and the logo unhighlighted on the hero URL', () => {
    renderTopBar();

    expect(screen.getByRole('link', { name: 'Be Original Youth Group' })).not.toHaveAttribute('aria-current');
    for (const link of screen.getAllByRole('link').filter(item => item.classList.contains('topbar-link'))) {
      expect(link).not.toHaveClass('topbar-link--active');
      expect(link).not.toHaveAttribute('aria-current');
    }
  });
});
