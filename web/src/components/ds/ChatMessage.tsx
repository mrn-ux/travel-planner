import type { ReactNode } from 'react';

interface ChatMessageProps {
  role?: 'agent' | 'user';
  text: string;
  followUps?: string[];
  /** Structured results (cards) rendered beneath the bubble, never as text inside it. */
  results?: ReactNode;
}

export function ChatMessage({ role = 'agent', text, followUps, results }: ChatMessageProps) {
  const isAgent = role === 'agent';
  return (
    <div className={`flex flex-col gap-2 font-sans ${isAgent ? 'items-start' : 'items-end'}`}>
      <div
        className={`max-w-bubble whitespace-pre-line rounded-md px-bubble-x py-bubble-y text-sm text-text ${isAgent ? 'bg-surface-muted' : 'bg-accent-soft'}`}
      >
        {text}
        {followUps && followUps.length > 0 && (
          <ul className={`m-0 list-disc pl-4 ${text ? "mt-2" : ""}`}>
            {followUps.map((q, i) => (
              <li key={i} className="mt-1">
                {q}
              </li>
            ))}
          </ul>
        )}
      </div>
      {results && <div className="flex max-w-results flex-col gap-3">{results}</div>}
    </div>
  );
}
