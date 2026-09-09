import React from 'react';
import type {} from './window';
import { createRoot, type Root } from 'react-dom/client';
import '../../src/index.css';
import '../../src/common/styles/brand.css';
import '../../src/common/styles/forms.css';
import '../../src/common/styles/pages.css';
import '../../src/common/components/Button/Button.css';

type StoryComponent = React.ComponentType<Record<string, unknown>>;
type StoryModule = Record<string, StoryComponent>;

const modules = import.meta.glob<StoryModule>('../../src/**/*.story.tsx', { eager: true });
const stories = new Map<string, StoryComponent>();

Object.entries(modules).forEach(([path, exports]) => {
  const moduleId = path.replace(/^\.\.\/\.\.\/src\//, '').replace(/\.story\.tsx$/, '');
  Object.entries(exports).forEach(([exportName, story]) => {
    stories.set(`${moduleId}/${exportName}`, story);
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Component gallery root is missing');
let root: Root | null = null;

window.mount = async ({ story: storyId, props = {} }) => {
  const matches = [...stories.entries()].filter(([id]) => id === storyId || id.endsWith(`/${storyId}`));
  if (matches.length !== 1) {
    throw new Error(matches.length ? `Ambiguous story: ${storyId}` : `Unknown story: ${storyId}`);
  }
  root ??= createRoot(rootElement);
  const Story = matches[0][1];
  root.render(<Story {...props} />);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
};

window.unmount = async () => {
  root?.unmount();
  root = null;
};
