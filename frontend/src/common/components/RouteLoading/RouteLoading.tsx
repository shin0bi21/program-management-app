import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './RouteLoading.css';

/**
 * Displays a full-page spinner with a "Loading page" status while lazy code or
 * authentication is pending.
 * @example <Suspense fallback={<RouteLoading />}><LazyRoute /></Suspense>
 */
export default function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading page">
      <LoadingSpinner size="lg" />
    </div>
  );
}
