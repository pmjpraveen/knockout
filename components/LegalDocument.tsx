import { Fragment } from 'react';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { LegalSection, legalUpdated, supportEmail } from '@/lib/legal';

export function LegalDocument({ sections }: { sections: LegalSection[] }) {
  return (
    <Screen>
      <Text color="slateGray">Last updated {legalUpdated}</Text>
      {sections.map((section) => (
        <Fragment key={section.heading}>
          <Text variant="subheading">{section.heading}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} color="charcoal">{paragraph}</Text>
          ))}
        </Fragment>
      ))}
      {supportEmail ? <Text color="charcoal">Questions about this? Write to {supportEmail}.</Text> : null}
    </Screen>
  );
}
