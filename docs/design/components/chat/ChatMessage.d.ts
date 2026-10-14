/**
 * @startingPoint section="Chat" subtitle="Agent / user conversation bubble with follow-ups and result cards" viewport="700x220"
 */
export interface ChatMessageProps {
  role: 'agent' | 'user';
  text: string;
  followUps?: string[];
  results?: React.ReactNode;
}
export function ChatMessage(props: ChatMessageProps): JSX.Element;
