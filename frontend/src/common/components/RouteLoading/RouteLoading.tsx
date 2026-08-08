import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import './RouteLoading.css';

export default function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading page">
      <LoadingSpinner size="lg" />
    </div>
  );
}
