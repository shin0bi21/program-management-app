export interface AccountPageData {
  name: string;
  email: string;
  role: string;
  programNames: string;
  programsLoading: boolean;
  programsError: string | null;
  retryPrograms: () => Promise<void>;
}
