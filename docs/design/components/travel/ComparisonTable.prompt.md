Sortable hotel/transport comparison table — the product's main data-dense surface.

```jsx
<ComparisonTable
  columns={[{key:'name',label:'Hotel'},{key:'rating',label:'Rating',sortable:true},{key:'price',label:'Price',align:'right',tabular:true,sortable:true}]}
  rows={[{name:'Hotel Avenida', rating:'4.6', price:<>USD 184.00 <StatusBadge status="confirmed"/></>}]}
/>
```

Price columns are right-aligned, tabular, and always carry a `StatusBadge`. Last row has no bottom border.
