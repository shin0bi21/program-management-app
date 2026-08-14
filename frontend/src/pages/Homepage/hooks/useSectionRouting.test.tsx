import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSectionRouting } from './useSectionRouting';

let scheduledFrames: FrameRequestCallback[] = [];
let topBySection: Record<string, number> = {};

async function flushAnimationFrames() {
  await act(async () => {
    const frames = scheduledFrames;
    scheduledFrames = [];
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
    scheduledFrames = [];
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
      scheduledFrames.push(callback);
      return scheduledFrames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
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
});
