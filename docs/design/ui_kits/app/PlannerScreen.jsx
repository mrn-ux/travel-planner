function PlannerScreen({ onChooseDestination }) {
  const { ChatMessage, DestinationCard, Button } = window.FaroDesignSystem_c83241;
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChatMessage role="user" text="Somewhere warm in November, under $2,000, for 4 nights." />
      <ChatMessage role="agent" text="Here are two destinations that fit:"
        followUps={['Any neighborhood preference?', 'Flexible by a few days on dates?']}
        results={(
          <React.Fragment>
            <DestinationCard rank={1} name="Lisbon, Portugal" score={92}
              reasons={['Fits your budget with room to spare', 'Mild weather in November', 'Walkable, near the water']} />
            <DestinationCard rank={2} name="Marrakech, Morocco" score={81}
              reasons={['Warmer than Lisbon in November', 'Lower average hotel rates', 'Longer flight from your origin']} />
          </React.Fragment>
        )} />
      <div style={{ display: 'flex', gap: 12, alignSelf: 'flex-end' }}>
        <Button variant="secondary">View alternatives</Button>
        <Button variant="primary" onClick={() => onChooseDestination('Lisbon, Portugal')}>Compare hotels in Lisbon</Button>
      </div>
    </div>
  );
}
window.PlannerScreen = PlannerScreen;
