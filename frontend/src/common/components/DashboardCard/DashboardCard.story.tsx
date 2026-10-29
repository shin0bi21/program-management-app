import { useState } from 'react';
import { DashboardCard } from './DashboardCard';

export function LoadingAndOverflow() {
  const [loading, setLoading] = useState(false);

  return <div style={{ width: 'min(100%, 360px)' }}>
    <button onClick={() => setLoading(value => !value)}>Toggle loading</button>
    <DashboardCard title="Notes" loading={loading} loadingLabel="Loading notes…" action={<button disabled={loading}>Add note</button>}>
      {Array.from({ length: 20 }, (_, index) => <p key={index}>Note {index + 1}</p>)}
    </DashboardCard>
  </div>;
}
