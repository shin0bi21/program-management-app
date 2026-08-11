import { useState } from 'react';
import Modal from './Modal';

export function Interactive() {
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

export function CloseDisabled() {
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

export function Submitting() {
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

export function SuccessDelay() {
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

export function Success() {
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
