import type { School } from '../types';
import { useSchoolReferences } from '../../referenceData/hooks/useReferenceData';

export type { School };

export function useSchools() {
  const query = useSchoolReferences();

  return {
    schools: query.rows,
    upsertSchool: query.upsert,
    removeSchool: query.remove,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
  };
}
