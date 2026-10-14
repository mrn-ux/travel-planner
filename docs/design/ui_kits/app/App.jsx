function App() {
  const [screen, setScreen] = React.useState('home');
  const [destination, setDestination] = React.useState('Lisbon, Portugal');
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <window.Nav screen={screen} setScreen={setScreen} />
      {screen === 'home' && <window.HomeScreen onPlan={() => setScreen('planner')} />}
      {screen === 'planner' && <window.PlannerScreen onChooseDestination={d => { setDestination(d); setScreen('hotels'); }} />}
      {screen === 'hotels' && <window.HotelsScreen destination={destination} onBook={() => setScreen('itinerary')} />}
      {screen === 'itinerary' && <window.ItineraryScreen />}
      {screen === 'trips' && <window.MyTripsScreen onPlan={() => setScreen('home')} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
