/**
 * @startingPoint section="Core" subtitle="Primary/secondary/ghost/danger button" viewport="700x150"
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  children: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
