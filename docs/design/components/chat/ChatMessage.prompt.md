Conversation bubble for the Faro intake/planning chat. Agent messages left-aligned on `surface-muted`; user messages right-aligned on `accent-soft`.

```jsx
<ChatMessage role="agent" text="I found 12 hotels under your budget." followUps={['Any neighborhood preference?']} />
<ChatMessage role="user" text="Somewhere walkable, near the water." />
<ChatMessage role="agent" text="Here's what I found:" results={<DestinationCard .../>} />
```

Structured results (hotel cards, recommendation lists) render in `results` as cards beneath the bubble — never as text inside it.
