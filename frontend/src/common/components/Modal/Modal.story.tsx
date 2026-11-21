import { useState, type ReactElement } from 'react';
import Modal from './Modal';
import FloatingSelect from '../FloatingSelect/FloatingSelect';

export function Interactive(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <main style={{ minHeight: '150vh', padding: 24 }}>
      <button type="button" onClick={() => setIsOpen(true)}>Open profile</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit Profile"
        footer={<button type="button" onClick={() => setIsOpen(false)}>Save</button>}
      >
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" defaultValue="Ada" />
      </Modal>
    </main>
  );
}

export function CloseDisabled(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={() => setIsOpen(true)}>Open submitting modal</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Submitting" disableClose>
        Please wait.
      </Modal>
    </div>
  );
}

export function Submitting(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={() => setIsOpen(true)}>Open active submission</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Active submission" status="submitting">
        Please wait.
      </Modal>
    </div>
  );
}

export function SuccessDelay(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={() => setIsOpen(true)}>Open success delay</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Success delay"
        status="success"
        successDelay={10_000}
      >
        Saved.
      </Modal>
    </div>
  );
}

export function Success(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ padding: 24 }}>
      <button type="button" onClick={() => setIsOpen(true)}>Open completed submission</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Completed submission" status="success">
        Saved.
      </Modal>
    </div>
  );
}

/**
 * Opens an editor with a dropdown so Escape dismissal can be checked across the portal.
 * @example Escape closes the choice popup before a second Escape closes the editor.
 */
export function DropdownEditor(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('one');

  return <div>
    <button type="button" onClick={() => setIsOpen(true)}>Open editor</button>
    <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Editor">
      <label htmlFor="editor-name">Name</label>
      <input id="editor-name" defaultValue="unfinished" />
      <FloatingSelect id="editor-choice" ariaLabel="Choice" value={value} onChange={setValue}
        options={[{ id: 'one', label: 'One' }]} />
    </Modal>
  </div>;
}
