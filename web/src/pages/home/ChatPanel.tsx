import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ds/Button';
import { ChatMessage } from '../../components/ds/ChatMessage';
import { Input } from '../../components/ds/Input';
import { ApiError } from '../../lib/api';
import {
  patchTrip,
  retryLastMessage,
  sendMessage,
  splitReply,
  type ChatMessageData,
  type TripState,
  type TurnResponse,
} from '../../lib/trip';
import { ResultCards } from './ResultCards';
import { StarterChips, type StarterChip } from './StarterChips';

interface ChatPanelProps {
  tripId: string;
  messages: ChatMessageData[];
  onMessages: (next: ChatMessageData[]) => void;
  /** Called with the fresh trip after every turn so the form shows what the agent understood. */
  onTripState: (state: TripState) => void;
  /** Tells the screen when a reply is being produced (New trip is disabled meanwhile). */
  onPendingChange?: (pending: boolean) => void;
}

const MAX_LENGTH = 4000;

/** The chat column: headline and starter chips first, then the conversation with a pinned input row. */
export function ChatPanel({ tripId, messages, onMessages, onTripState, onPendingChange }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view, but never scroll the page just because the screen opened.
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    if (messages.length === 0 && !pending && !error) return;
    bottomRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messages, pending, error]);

  const finish = (res: TurnResponse, base: ChatMessageData[]) => {
    onMessages([...base, res.userMessage, res.agentMessage]);
    onTripState({ trip: res.trip, missing: res.missing });
  };

  const send = async (text: string, base: ChatMessageData[], recommend = false) => {
    setPending(true);
    setError(null);
    // Show the traveler's message straight away; a negative id marks it as not yet stored.
    const optimistic: ChatMessageData = { id: -Date.now(), role: 'user', content: text, cards: null, createdAt: new Date().toISOString() };
    onMessages([...base, optimistic]);
    try {
      if (recommend) onTripState(await patchTrip(tripId, { recommendRequested: true }));
      finish(await sendMessage(tripId, text), base);
    } catch (err) {
      const storedMessage = err instanceof ApiError ? (err.body?.['userMessage'] as ChatMessageData | undefined) : undefined;
      const message = err instanceof ApiError ? err.message : 'The assistant could not reply.';
      // The server stores the message before the assistant runs, so Retry re-runs it without sending a duplicate.
      const serverHasIt = err instanceof ApiError && (err.status === 502 || err.status === 504);
      setError({
        message,
        retry: () => {
          if (serverHasIt) void retry([...base, storedMessage ?? optimistic]);
          else void send(text, base);
        },
      });
    } finally {
      setPending(false);
    }
  };

  const retry = async (current: ChatMessageData[]) => {
    setPending(true);
    setError(null);
    try {
      const res = await retryLastMessage(tripId);
      onMessages([...current.filter((m) => m.id > 0 && m.id !== res.userMessage.id), res.userMessage, res.agentMessage]);
      onTripState({ trip: res.trip, missing: res.missing });
    } catch (err) {
      setError({ message: err instanceof ApiError ? err.message : 'The assistant could not reply.', retry: () => void retry(current) });
    } finally {
      setPending(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;
    if (text.length > MAX_LENGTH) {
      setError({ message: `That message is too long (${MAX_LENGTH.toLocaleString('en-US')} characters at most).`, retry: () => setError(null) });
      return;
    }
    setDraft('');
    void send(text, messages);
  };

  const choose = (chip: StarterChip) => {
    void send(chip.message, messages, chip.recommend);
  };

  const started = messages.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg bg-surface/75 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-chat flex-col gap-3 self-center">
        {!started && !pending && <StarterChips onChoose={choose} disabled={pending} />}
        {messages.map((m) => {
          if (m.role === 'user') return <ChatMessage key={m.id} role="user" text={m.content} />;
          const { text, followUps } = splitReply(m.content);
          return (
            <ChatMessage
              key={m.id}
              role="agent"
              text={text || (followUps.length > 0 ? '' : m.content)}
              followUps={followUps}
              results={m.cards && m.cards.length > 0 ? <ResultCards cards={m.cards} /> : undefined}
            />
          );
        })}
        {pending && (
          <div role="status" aria-live="polite" className="text-sm text-text-muted">
            Faro is working on it...
          </div>
        )}
        {error && (
          <div role="alert" className="flex flex-col items-start gap-2 rounded-md border border-danger bg-danger/10 px-4 py-3 text-sm">
            <div className="text-danger">{error.message}</div>
            <Button variant="secondary" onClick={error.retry}>
              Retry
            </Button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="sticky bottom-0 flex items-end gap-2 rounded-md bg-surface/80 p-2 backdrop-blur-sm">
        <div className="flex-1">
          <Input placeholder="Message Faro..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <Button type="submit" disabled={pending || draft.trim() === ''}>
          Send
        </Button>
      </form>
    </div>
  );
}
