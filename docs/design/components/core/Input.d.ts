/**
 * @startingPoint section="Core" subtitle="Text input with label, focus ring and error state" viewport="700x120"
 */
export interface InputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
}
export function Input(props: InputProps): JSX.Element;
