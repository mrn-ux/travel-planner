Labeled select dropdown, matches Input styling exactly (40px, radius sm, same border/focus rules).

```jsx
<Select label="Currency" value={cur} onChange={e=>setCur(e.target.value)} options={['USD','EUR','GBP']} />
```
