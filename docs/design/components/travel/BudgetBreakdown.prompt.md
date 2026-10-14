Horizontal stacked budget bar in fixed category order (hotels, transportation, activities, food, local transport, misc), legend beneath, totals row last.

```jsx
<BudgetBreakdown
  categories={[{label:'Hotels',amount:920},{label:'Transportation',amount:410},{label:'Activities',amount:260},{label:'Food',amount:380},{label:'Local transport',amount:90},{label:'Misc',amount:100}]}
  total="USD 2,160.00" budget="USD 2,000.00" remaining="-USD 160.00"
/>
```

`remaining` renders `over-budget` orange when negative, `under-budget` green when positive — pass the sign in the formatted string.
