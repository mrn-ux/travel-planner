function ItineraryScreen() {
  const { DayItineraryCard, BudgetBreakdown } = window.FaroDesignSystem_c83241;
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-2xl-size)', color: 'var(--text)' }}>Lisbon, Portugal — 12–16 Nov 2026</div>
      <DayItineraryCard day={1} date="12 Nov 2026"
        morning={[{ title: 'Belém Tower', duration: '1h 30m', cost: 'USD 6.00', hours: 'Open 10:00–17:30', travelTime: '15m' }]}
        afternoon={[{ title: 'Time Out Market', duration: '1h', cost: 'USD 18.00', travelTime: '10m' }]}
        evening={[{ title: 'Fado dinner, Alfama', duration: '2h', cost: 'USD 42.00' }]} />
      <DayItineraryCard day={2} date="13 Nov 2026"
        morning={[{ title: 'Sintra day trip', duration: '5h', cost: 'USD 34.00', hours: 'Trains from 07:30' }]} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-raised)', padding: 24 }}>
        <BudgetBreakdown
          categories={[{ label: 'Hotels', amount: 920 }, { label: 'Transportation', amount: 410 }, { label: 'Activities', amount: 260 }, { label: 'Food', amount: 380 }, { label: 'Local transport', amount: 90 }, { label: 'Misc', amount: 100 }]}
          total="USD 2,160.00" budget="USD 2,000.00" remaining="-USD 160.00" />
      </div>
    </div>
  );
}
window.ItineraryScreen = ItineraryScreen;
