Centered confirmation dialog over a 40%-dark backdrop. Used for booking confirmation and cancel-trip confirmation.

```jsx
<Modal title="Cancel this trip?" actions={<><Button variant="secondary">Keep trip</Button><Button variant="danger">Cancel trip</Button></>}>
  This can't be undone. Your held prices will be released.
</Modal>
```

Primary/destructive action is always last (rightmost) in `actions`.
