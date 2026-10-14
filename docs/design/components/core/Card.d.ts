/**
 * @startingPoint section="Core" subtitle="Base surface card with optional Spectral title" viewport="700x160"
 */
export interface CardProps {
  title?: string;
  padding?: number;
  children: React.ReactNode;
}
export function Card(props: CardProps): JSX.Element;
