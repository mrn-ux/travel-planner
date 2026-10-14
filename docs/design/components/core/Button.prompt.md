Primary call-to-action button in four variants, used for every clickable action in Faro.

```jsx
<Button variant="primary" onClick={planTrip}>Plan my trip</Button>
<Button variant="secondary">View alternatives</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="danger">Cancel booking</Button>
```

Variants: `primary` (accent fill, "Plan my trip" / "Book now" / "Confirm"), `secondary` (outlined), `ghost` (text-only, row actions), `danger` (cancel/delete only). `disabled` drops opacity to 40% and removes pointer events.
