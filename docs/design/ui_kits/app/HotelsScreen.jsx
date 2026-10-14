function HotelsScreen({ destination, onBook }) {
  const { ComparisonTable, StatusBadge, Button, Modal, BookingStepper } = window.FaroDesignSystem_c83241;
  const [sortKey, setSortKey] = React.useState('price');
  const [picking, setPicking] = React.useState(null);
  const [step, setStep] = React.useState(0);

  const rows = [
    { name: 'Hotel Avenida', location: 'Baixa', rating: '4.6', price: <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>USD 184.00 <StatusBadge status="confirmed" /></span>, hotel: 'Hotel Avenida', amount: 'USD 184.00' },
    { name: 'Baixa House', location: 'Baixa', rating: '4.3', price: <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>USD 152.00 <StatusBadge status="estimated" /></span>, hotel: 'Baixa House', amount: 'USD 152.00' },
    { name: 'Alfama Suites', location: 'Alfama', rating: '4.8', price: <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>— <StatusBadge status="unavailable" /></span>, hotel: 'Alfama Suites', amount: '—' },
  ];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-2xl-size)', color: 'var(--text)' }}>Hotels in {destination}</div>
      <ComparisonTable
        sortKey={sortKey} onSort={setSortKey}
        columns={[{ key: 'name', label: 'Hotel' }, { key: 'location', label: 'Area' }, { key: 'rating', label: 'Rating', sortable: true }, { key: 'price', label: 'Price / night', align: 'right', tabular: true, sortable: true }]}
        rows={rows.map(r => ({ ...r, price: <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>{r.price}<Button variant="ghost" onClick={() => { setPicking(r); setStep(0); }}>Select</Button></span> }))}
      />
      {picking && (
        <Modal title={`Book ${picking.hotel}`} onClose={() => setPicking(null)}
          actions={<React.Fragment>
            <Button variant="secondary" onClick={() => setPicking(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => { if (step < 6) setStep(step + 1); else { setPicking(null); onBook(); } }}>{step < 6 ? 'Continue' : 'Done'}</Button>
          </React.Fragment>}>
          <BookingStepper currentStep={step} />
          <div style={{ marginTop: 24, color: 'var(--text-secondary)' }}>{picking.amount} / night · {picking.hotel}</div>
        </Modal>
      )}
    </div>
  );
}
window.HotelsScreen = HotelsScreen;
