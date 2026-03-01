import { useState } from 'react';
import Header from '../../common/components/Header/Header';
import Table, { TableColumn } from '../../common/components/Table/Table';
import { useYouth, YouthProfile } from './hooks/useYouth';
import YouthModal from './components/YouthModal/YouthModal';
import './Youth.css';

function calculateAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return 'N/A';
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
}

export default function Youth() {
  const [showAddYouth, setShowAddYouth] = useState(false);
  const [youthToEdit, setYouthToEdit] = useState<YouthProfile | undefined>(undefined);
  const { youth, setYouth, loading, error } = useYouth();

  const youthColumns: TableColumn<YouthProfile>[] = [
    {
      key: 'firstName',
      header: 'First Name',
      render: (profile) => profile.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      render: (profile) => profile.lastName,
    },
    {
      key: 'age',
      header: 'Age',
      render: (profile) => calculateAge(profile.dateOfBirth),
      width: '80px',
    },
    {
      key: 'school',
      header: 'School',
      render: (profile) => profile.schoolName ?? 'N/A',
    },
    {
      key: 'grade',
      header: 'Grade',
      render: (profile) => profile.gradeLevel ?? 'N/A',
      width: '100px',
    },
    {
      key: 'active',
      header: 'Status',
      render: (profile) => (
        <span className={`status-badge ${profile.active ? 'status-active' : 'status-inactive'}`}>
          {profile.active ? 'Active' : 'Inactive'}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (profile) => (
        <button
          className="page-action-btn"
          onClick={() => {
            setYouthToEdit(profile);
            setShowAddYouth(true);
          }}
        >
          Edit
        </button>
      ),
      width: '100px',
    },
  ];

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Youth</h1>
            <button className="page-add-btn" onClick={() => setShowAddYouth(true)}>
              + Add Youth
            </button>
          </div>
        </div>

        <Table
          columns={youthColumns}
          data={youth}
          loading={loading}
          error={error}
          emptyMessage="No youth profiles found"
          keyExtractor={(profile) => profile.id}
          maxHeight="calc(100vh - 200px)"
        />
      </div>

      <YouthModal
        isOpen={showAddYouth}
        youthData={youthToEdit}
        onClose={() => {
          setShowAddYouth(false);
          setYouthToEdit(undefined);
        }}
        onSuccess={(savedYouth) => {
          setShowAddYouth(false);
          setYouthToEdit(undefined);
          if (youthToEdit) {
            setYouth(youth.map(y => y.id === savedYouth.id ? savedYouth : y));
          } else {
            setYouth([...youth, savedYouth]);
          }
        }}
      />
    </>
  );
}
