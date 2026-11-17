import { useCallback, useState } from 'react';
import { useAuth } from '../../auth/authContext';
import PageContainer from '../../common/components/PageContainer/PageContainer';
import Button from '../../common/components/Button/Button';
import { type PageMessageValue } from '../../common/components/PageMessageOverlay/PageMessageOverlay';
import SchoolModal from '../../common/features/SchoolModal/SchoolModal';
import useSchoolModal from '../../common/features/SchoolModal/hooks/useSchoolModal';
import YouthModal from './components/YouthModal/YouthModal';
import { YOUTH_TABLE_KEYS, type YouthProfile } from './types';
import ProfileNoteDialogs from './components/ProfileNotes/ProfileNoteDialogs';
import useProfileNotes from './components/ProfileNotes/useProfileNotes';
import PrimaryContactDashboardCard from '../../common/features/contacts/components/PrimaryContactDashboardCard/PrimaryContactDashboardCard';
import YouthAttendanceDashboardCard from './components/YouthDashboard/YouthAttendanceDashboardCard/YouthAttendanceDashboardCard';
import YouthNotesDashboardCard from './components/YouthDashboard/YouthNotesDashboardCard/YouthNotesDashboardCard';
import YouthTable from './components/YouthTable/YouthTable';
import useYouthTable from './components/YouthTable/hooks/useYouthTable';
import { useYouthActions } from './hooks/actions/useYouthActions';
import { useYouthSelection } from './hooks/selection/useYouthSelection';
import { useYouthControls } from './hooks/controls/useYouthControls';
import useYouthData from './hooks/data/useYouthData';
import './Youth.css';

/**
 * Coordinates saved Youth selection, collection controls, and profile workflows.
 * @example <Youth /> // selected profiles remain available when table filters change
 */
export default function Youth() {
  // Page-local errors.
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions and services.
  const { permissions, role } = useAuth();
  const canWrite = permissions.includes('write:youth_profiles');
  const canReadAttendance = permissions.includes('read:attendance') && permissions.includes('read:sessions');
  const canManageAttendance = canReadAttendance
    && permissions.includes('write:attendance')
    && permissions.includes('read:sessions');
  const canViewAttendanceReport = permissions.includes('read:programs')
    && permissions.includes('read:attendance')
    && permissions.includes('read:sessions');

  // Page data and preferences.
  const {
    programs, programsLoading, programsError,
    cycles, cyclesLoading, cyclesError,
    schools, schoolsLoading, schoolsError,
  } = useYouthData(role === 'staff');
  const controls = useYouthControls({
    role,
    programs,
    programsLoading,
    programsError,
    cycles,
    cyclesLoading,
    cyclesError,
    schools,
    schoolsLoading,
    schoolsError,
    tableKeys: YOUTH_TABLE_KEYS,
  });
  const { table, error: preferencesError } = controls;

  // Selection and selection-dependent workflow synchronization.
  const { selectedProfile, selectedProfileId, selectProfile, updateSelectedProfile } = useYouthSelection();

  // Page actions.
  const { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance } = useYouthActions(updateSelectedProfile);

  // Profile-note actions and dialogs.
  const profileNotes = useProfileNotes(selectedProfileId);
  const openProfileNoteEditor = profileNotes.openEditor;

  // Youth modal.
  const [modalTarget, setModalTarget] = useState<YouthProfile | 'new' | null>(null);
  const isYouthModalOpen = modalTarget !== null;
  const modalYouthData = modalTarget && modalTarget !== 'new' ? modalTarget : undefined;
  const schoolModal = useSchoolModal();
  const closeYouthModal = () => {
    schoolModal.close();
    setModalTarget(null);
  };

  // Primary-contact modal.
  const [contactTarget, setContactTarget] = useState<YouthProfile | null>(null);
  const isContactModalOpen = contactTarget !== null;
  const closeContactModal = () => setContactTarget(null);

  // Table configuration.
  const addProfileNote = useCallback((youthId: string) => {
    openProfileNoteEditor('new', youthId);
  }, [openProfileNoteEditor]);
  const { columns: youthColumns } = useYouthTable({
    canWrite,
    onEdit: setModalTarget,
    onAddNote: addProfileNote,
  });

  // Render.
  return (
    <>
      <PageContainer
        title="Profiles"
        actions={canWrite ? <Button onClick={() => setModalTarget('new')}>+ Add</Button> : undefined}
        ariaLabel="Youth profiles"
        controls={controls}
        loadingLabel="Loading saved youth preferences…"
        search={{ label: 'Search youth', placeholder: 'Search youth, school, or program' }}
        columns={youthColumns}
        messages={[
          preferencesError,
          programsError,
          cyclesError,
          schoolsError,
          viewError,
        ]}
        dashboard={<>
          <PrimaryContactDashboardCard
            contact={selectedProfile?.contacts?.[0] ? {
              phoneNumber: selectedProfile.contacts[0].phoneNumber,
              relationship: selectedProfile.contacts[0].type,
            } : null}
            selected={selectedProfile !== null}
            action={canWrite ? <Button
              size="sm"
              variant="secondary"
              disabled={!selectedProfile}
              aria-label="Manage primary contact"
              onClick={() => { if (selectedProfile) setContactTarget(selectedProfile); }}
            >Manage</Button> : undefined}
          />
          {canReadAttendance && <YouthAttendanceDashboardCard
            youthId={selectedProfileId}
            canManage={canManageAttendance}
            youth={selectedProfile}
            onSaved={reconcileAttendance}
            canViewReport={canViewAttendanceReport}
          />}
          <YouthNotesDashboardCard
            youthId={selectedProfileId}
            canManageProfileNotes={canWrite}
            onSelectProfileNote={profileNotes.openDetails}
            onAddProfileNote={() => profileNotes.openEditor('new')}
            onEditProfileNote={profileNotes.openEditor}
            onDeleteProfileNote={profileNotes.requestDelete}
          />
        </>}
        table={<YouthTable
          columns={youthColumns}
          filters={controls.appliedFilters}
          hiddenColumnKeys={table.hiddenColumns}
          selectedProfileId={selectedProfileId}
          onRowSelect={selectProfile}
          sorting={table.sorting}
          onSortingChange={table.setSorting}
          columnWidths={table.columnWidths}
          onColumnWidthsChange={table.setColumnWidths}
          onMessageChange={setViewError}
        />}
      />

      <YouthModal
        isOpen={isYouthModalOpen}
        suspended={schoolModal.action !== null}
        onManageSchool={schoolModal.open}
        youthData={modalYouthData}
        onClose={closeYouthModal}
        onSuccess={modalTarget === 'new' ? reconcileCreatedYouth : reconcileSavedYouth}
      />
      <SchoolModal workflow={schoolModal} />
      <YouthModal
        isOpen={isContactModalOpen}
        youthData={contactTarget ?? undefined}
        mode="contact"
        onClose={closeContactModal}
        onSuccess={reconcileSavedYouth}
      />

      <ProfileNoteDialogs
        editorTarget={profileNotes.editorTarget}
        selectedNote={profileNotes.selectedNote}
        canManage={canWrite}
        confirmAction={profileNotes.confirmAction}
        onCloseEditor={profileNotes.closeEditor}
        onSaved={profileNotes.handleSaved}
        onCloseDetails={profileNotes.closeDetails}
        onEdit={profileNotes.openEditor}
        onRequestDelete={profileNotes.requestDelete}
        onCloseConfirmation={profileNotes.closeConfirmation}
      />
    </>
  );
}
