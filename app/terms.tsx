import { LegalDocument } from '@/components/LegalDocument';
import { terms } from '@/lib/legal';

export default function Terms() {
  return <LegalDocument sections={terms} />;
}
