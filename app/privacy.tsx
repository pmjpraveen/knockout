import { LegalDocument } from '@/components/LegalDocument';
import { privacy } from '@/lib/legal';

export default function Privacy() {
  return <LegalDocument sections={privacy} />;
}
