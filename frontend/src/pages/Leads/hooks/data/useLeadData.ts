import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
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

/**
 * Supplies shared program references for lead filters and forms.
 * @example const { programs } = useLeadData()
 */
export default function useLeadData() {
  const programs = useProgramReferences();

  return {
    programs: programs.rows,
    programsLoading: programs.loading,
    programsError: programs.error,
  };
}
