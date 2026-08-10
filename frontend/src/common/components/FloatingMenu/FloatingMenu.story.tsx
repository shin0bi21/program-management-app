import { useRef, useState } from 'react';
import FloatingMenuPanel from './FloatingMenuPanel';
import { useFloatingMenu } from './hooks/useFloatingMenu';

export function Interactive() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menu = useFloatingMenu(triggerRef, { side: 'bottom', align: 'end' });

  return (
    <div style={{ minHeight: '100vh', padding: 24 }}>
      <button ref={triggerRef} type="button" onClick={menu.toggle}>Actions</button>
      {menu.position && (
        <FloatingMenuPanel menuRef={menu.menuRef} position={menu.position} onClose={menu.close}>
          <button type="button" role="menuitem">Edit</button>
          <button type="button" role="menuitem">Duplicate</button>
          <button type="button" role="menuitem">Archive</button>
        </FloatingMenuPanel>
      )}
      <button type="button" style={{ marginLeft: 16 }}>Outside target</button>
    </div>
  );
}

export function EdgeCollision() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menu = useFloatingMenu(triggerRef, { side: 'bottom', align: 'start' });

  return (
    <div style={{ minHeight: '100vh' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={menu.toggle}
        style={{ position: 'fixed', bottom: 4, right: 4 }}
      >
        Edge actions
      </button>
      {menu.position && (
        <FloatingMenuPanel menuRef={menu.menuRef} position={menu.position} onClose={menu.close} width={220}>
          <button type="button" role="menuitem">First edge action</button>
          <button type="button" role="menuitem">Second edge action</button>
        </FloatingMenuPanel>
      )}
    </div>
  );
}

export function ResizeAware() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const menu = useFloatingMenu(triggerRef, { side: 'bottom', align: 'start' });

  return (
    <div style={{ minHeight: '100vh' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={menu.toggle}
        style={{ position: 'fixed', bottom: 8, left: 24 }}
      >
        Resize-aware actions
      </button>
      {menu.position && (
        <FloatingMenuPanel menuRef={menu.menuRef} position={menu.position} onClose={menu.close}>
          <button type="button" role="menuitem" onClick={() => setExpanded(true)}>Show more</button>
          {expanded && Array.from({ length: 6 }, (_, index) => (
            <button key={index} type="button" role="menuitem">Extra action {index + 1}</button>
          ))}
        </FloatingMenuPanel>
      )}
    </div>
  );
}
