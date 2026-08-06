import './RouteLoading.css';

export default function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-label="Loading page">
      <span className="route-loading__spinner" aria-hidden="true" />
    </div>
  );
}
