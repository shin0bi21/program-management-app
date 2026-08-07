import './NoteCategoryBadge.css';

export default function NoteCategoryBadge({
  category,
  label,
}: {
  category: string;
  label: string;
}) {
  return <span className={`note-category note-category--${category}`}>{label}</span>;
}
