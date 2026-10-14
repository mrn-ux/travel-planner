function HomeScreen({ onPlan }) {
  const { Button, Input, Select } = window.FaroDesignSystem_c83241;
  const [desc, setDesc] = React.useState('Somewhere warm in November, under $2,000, for 4 nights.');
  return (
    <div style={{ maxWidth: 560, margin: '96px auto', display: 'flex', flexDirection: 'column', gap: 24, padding: '0 16px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-3xl-size)', lineHeight: 'var(--text-3xl-lh)', color: 'var(--text)', textAlign: 'center' }}>Where do you want to go?</div>
      <Input label="Describe your trip" value={desc} onChange={e => setDesc(e.target.value)} />
      <div style={{ display: 'flex', gap: 16 }}>
        <Select label="Currency" options={['USD', 'EUR', 'GBP']} />
        <Input label="Budget" placeholder="2,000" />
      </div>
      <Button variant="primary" onClick={onPlan}>Plan my trip</Button>
    </div>
  );
}
window.HomeScreen = HomeScreen;
