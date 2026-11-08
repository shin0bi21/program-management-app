import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import { createRecordStore } from '../../../../query/createRecordStore';
import type { ListSort } from '../../../../common/components/Table/Table.types';
import type { Lead, LeadSortKey } from '../../types';

/**
 * Supplies the server-compatible value for a lead's selected order.
 * @param lead - Complete saved lead.
 * @param key - Active table sort column.
 * @example getLeadSortValue(lead, 'firstName') // lower-case youth first name
 */
export function getLeadSortValue(lead: Lead, key: LeadSortKey) {
  return {
    firstName: lead.youthFirstName.toLowerCase(),
    lastName: lead.youthLastName.toLowerCase(),
    school: lead.school.toLowerCase(),
    program: lead.recommendedProgram?.toLowerCase() ?? '',
    status: lead.status,
    created: new Date(lead.createdAt),
  }[key];
}

export const leadData = createRecordStore<Lead>({
  queryKey: ['leads', 'records'],
  listKey: ['leads', 'table'],
  getSortValue: (lead, queryKey) => {
    const sorting = queryKey[queryKey.length - 1] as ListSort<LeadSortKey>;
    return getLeadSortValue(lead, sorting.key);
  },
});

/**
 * Supplies the route's current saved leads and shared program references.
 * The page passes records to selection and view children; each view owns its membership query.
 * @example const { records } = useLeadData() // resolve a selected lead by ID
 */
export default function useLeadData() {
  const records = leadData.useRecords();
  const programs = useProgramReferences();

  return {
    records,
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
  };
}
