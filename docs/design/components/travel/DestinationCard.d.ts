/**
 * @startingPoint section="Travel" subtitle="Ranked recommendation with reasons and a score bar" viewport="700x160"
 */
export interface DestinationCardProps {
  rank: number;
  name: string;
  reasons?: string[];
  score: number;
}
export function DestinationCard(props: DestinationCardProps): JSX.Element;
