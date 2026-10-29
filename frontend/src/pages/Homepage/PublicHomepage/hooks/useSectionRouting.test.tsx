import { act, fireEvent, render, screen } from '@testing-library/react';
import { lazy, Suspense } from 'react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSectionRouting } from './useSectionRouting';

let scheduledFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 0;
let topBySection: Record<string, number> = {};

async function flushAnimationFrames() {
  await act(async () => {
    const frames = [...scheduledFrames.values()];
    scheduledFrames.clear();
    frames.forEach(callback => callback(0));
  });
}

function SectionRoutingHarness() {
  useSectionRouting();
  const location = useLocation();

  return <>
    <output aria-label="Current path">{location.pathname}</output>
    <section id="home" />
    <section id="programming" />
    <section id="signup" />
    <section id="about" />
    <section id="team" />
    <section id="partners" />
  </>;
}

describe('useSectionRouting', () => {
  beforeEach(() => {
    scheduledFrames = new Map();
    nextFrameId = 0;
    topBySection = {
      home: -100,
      programming: 700,
      signup: 1500,
      about: 2300,
      team: 3100,
      partners: 3900,
    };
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++nextFrameId;
      scheduledFrames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { scheduledFrames.delete(id); });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return new DOMRect(0, topBySection[this.id] ?? 0, 100, 400);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('updates React Router when scrolling changes the visible homepage section', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SectionRoutingHarness />
      </MemoryRouter>,
    );

    await flushAnimationFrames();
    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent('/');

    topBySection.home = -800;
    topBySection.programming = 100;
    fireEvent.scroll(window);
    await flushAnimationFrames();

    expect(screen.getByRole('status', { name: 'Current path' })).toHaveTextContent('/programming');
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('does not let homepage scrolling replace navigation while the account route loads', async () => {
    let finishLoading!: (module: { default: () => JSX.Element }) => void;
    const Account = lazy(() => new Promise<{ default: () => JSX.Element }>(resolve => {
      finishLoading = resolve;
    }));
    render(
      <MemoryRouter initialEntries={['/']}>
        <Suspense fallback={<p>Loading account</p>}>
          <Routes>
            <Route path="/" element={<><SectionRoutingHarness /><Link to="/settings/account">My Account</Link></>} />
            <Route path="/programming" element={<SectionRoutingHarness />} />
            <Route path="/settings/account" element={<Account />} />
          </Routes>
        </Suspense>
      </MemoryRouter>,
    );
    await flushAnimationFrames();

    topBySection.programming = 100;
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole('link', { name: 'My Account' }));
    expect(screen.getByText('Loading account')).toBeInTheDocument();
    fireEvent.scroll(window);
    await flushAnimationFrames();

    await act(async () => finishLoading({ default: () => <h1>My Account page</h1> }));
    expect(screen.getByRole('heading', { name: 'My Account page' })).toBeInTheDocument();
  });
});
