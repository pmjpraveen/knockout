import { View } from 'react-native';
import { ChoiceChips } from '@/components/ChoiceChips';
import { DateField } from '@/components/DateField';
import { TextField } from '@/components/TextField';
import { AthleteDraft, athleteGenders, belts } from '@/lib/athlete';
import { theme } from '@/theme/tokens';

const yearsAgo = (years: number) => new Date(new Date().getFullYear() - years, 0, 1, 12);

type Props = { value: AthleteDraft; onChange: (next: AthleteDraft) => void };

export function AthleteFields({ value, onChange }: Props) {
  const set = <K extends keyof AthleteDraft>(key: K) => (next: AthleteDraft[K]) => onChange({ ...value, [key]: next });

  return (
    <View style={{ gap: theme.spacing[12] }}>
      <TextField label="Full name" value={value.full_name} onChangeText={set('full_name')} autoCapitalize="words" />
      <DateField label="Date of birth" value={value.date_of_birth} onChange={set('date_of_birth')} maximumDate={new Date()} startAt={yearsAgo(12)} />
      <ChoiceChips label="Gender" options={athleteGenders} value={value.gender} onChange={set('gender')} />
      <TextField label="Weight (kg)" value={value.weight} onChangeText={set('weight')} keyboardType="numeric" />
      <ChoiceChips label="Belt" options={belts} value={value.belt_rank as (typeof belts)[number]} onChange={set('belt_rank')} />
    </View>
  );
}
