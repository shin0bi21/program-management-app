import Header from '../../common/components/Header/Header';
import Table, { TableColumn } from '../../common/components/Table/Table';
import { useStaff, StaffUser } from './hooks/useStaff';
import './Staff.css';

export default function Staff() {
  const { staff, loading, error } = useStaff();

  const staffColumns: TableColumn<StaffUser>[] = [
    {
      key: 'firstName',
      header: 'First Name',
      render: (user) => user.firstName,
    },
    {
      key: 'lastName',
      header: 'Last Name',
      render: (user) => user.lastName,
    },
  ];

  return (
    <>
      <Header />
      <div className="page-container">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Staff</h1>
          </div>
        </div>

        <Table
          columns={staffColumns}
          data={staff}
          loading={loading}
          error={error}
          emptyMessage="No staff users found"
          keyExtractor={(user) => user.id}
          maxHeight="calc(100vh - 200px)"
        />
      </div>
    </>
  );
}
