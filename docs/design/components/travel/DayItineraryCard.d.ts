/**
 * @startingPoint section="Travel" subtitle="One day, segmented Morning/Afternoon/Evening" viewport="700x320"
 */
export interface ItineraryItem {
  title: string;
  duration: string;
  cost: string;
  hours?: string;
  travelTime?: string;
}
export interface DayItineraryCardProps {
  day: number;
  date?: string;
  morning?: ItineraryItem[];
  afternoon?: ItineraryItem[];
  evening?: ItineraryItem[];
}
export function DayItineraryCard(props: DayItineraryCardProps): JSX.Element;
