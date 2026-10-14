function MyTripsScreen({ onPlan }) {
  const { KPICard, Card, Button, Modal, EmptyState } = window.FaroDesignSystem_c83241;
  const [canceling, setCanceling] = React.useState(false);
  const [canceled, setCanceled] = React.useState(false);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-2xl-size)', color: 'var(--text)' }}>My Trips</div>
      {!canceled ? (
        <React.Fragment>
          <Card title="Lisbon, Portugal" padding={24}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm-size)', marginBottom: 16 }}>4 nights · 12–16 Nov 2026</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <KPICard label="Estimated total" value="USD 2,160.00" />
              <KPICard label="Remaining" value="-USD 160.00" valueColor="var(--over-budget)" />
            </div>
            <Button variant="danger" onClick={() => setCanceling(true)}>Cancel booking</Button>
          </Card>
          <div style={{ fontSize: 'var(--text-sm-size)', fontWeight: 500, color: 'var(--text-secondary)' }}>Past trips</div>
          <EmptyState message="No past trips yet." />
        </React.Fragment>
      ) : (
        <EmptyState message="No trips yet — plan your first one." actionLabel="Plan a trip" onAction={onPlan} />
      )}
      {canceling && (
        <Modal title="Cancel this trip?" onClose={() => setCanceling(false)}
          actions={<React.Fragment>
            <Button variant="secondary" onClick={() => setCanceling(false)}>Keep trip</Button>
            <Button variant="danger" onClick={() => { setCanceling(false); setCanceled(true); }}>Cancel trip</Button>
          </React.Fragment>}>
          This can't be undone. Your held prices will be released.
        </Modal>
      )}
    </div>
  );
}
window.MyTripsScreen = MyTripsScreen;
