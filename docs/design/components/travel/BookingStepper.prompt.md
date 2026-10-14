Fixed seven-step horizontal booking flow: Select room → Verify availability → Price & terms → Guest details → Confirm → Pay → Confirmation.

```jsx
<BookingStepper currentStep={2} />
```

`currentStep` is a 0-based index. Completed steps show a filled check; the current step is a solid accent dot; future steps stay outlined/muted. Never allow skipping ahead of a verified step.
