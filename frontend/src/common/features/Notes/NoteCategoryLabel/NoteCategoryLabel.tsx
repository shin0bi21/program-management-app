import Label from '../../../components/Label/Label';
import './NoteCategoryLabel.css';

export default function NoteCategoryLabel({
  category,
  label,
}: {
  category: string;
  label: string;
}) {
  return <Label className={`note-category note-category--${category}`}>{label}</Label>;
}
