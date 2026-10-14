import { Button } from '../../components/ds/Button';

export interface StarterChip {
  label: string;
  /** The fixed opening message sent when the chip is chosen. */
  message: string;
  /** "Recommend somewhere for me" also records that the traveler wants a recommendation. */
  recommend?: boolean;
}

export const STARTER_CHIPS: StarterChip[] = [
  { label: 'I know my destination', message: 'I know where I want to go.' },
  { label: 'Recommend somewhere for me', message: 'Recommend somewhere for me.', recommend: true },
  { label: 'Just exploring', message: "I'm just exploring." },
];

/** The headline and three starter chips shown in the chat before the first message. */
export function StarterChips({ onChoose, disabled }: { onChoose: (chip: StarterChip) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 pt-8">
      <h1 className="text-center font-display text-3xl font-semibold text-text">Where do you want to go?</h1>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTER_CHIPS.map((chip) => (
          <Button key={chip.label} variant="secondary" disabled={disabled} onClick={() => onChoose(chip)}>
            {chip.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
