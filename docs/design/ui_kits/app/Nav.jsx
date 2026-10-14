function Nav({ screen, setScreen }) {
  const { NavItem } = window.FaroDesignSystem_c83241;
  return (
    <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div onClick={() => setScreen('home')} style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'var(--text)', cursor: 'pointer' }}>Faro</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <NavItem active={screen === 'trips'} onClick={() => setScreen('trips')}>My Trips</NavItem>
        <NavItem>Profile</NavItem>
      </div>
    </div>
  );
}
window.Nav = Nav;
