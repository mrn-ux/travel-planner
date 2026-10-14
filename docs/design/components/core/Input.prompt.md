Labeled text input, 40px tall, with focus ring and inline error message.

```jsx
<Input label="Destination" placeholder="e.g. Lisbon" value={v} onChange={e=>setV(e.target.value)} />
<Input label="Travel dates" error="Return date must be after departure" />
```

Label sits above in `sm` weight-500 `text-secondary`. On error, border turns `danger` and the message renders in `xs` `danger` directly beneath.
