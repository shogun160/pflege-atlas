export function PiiNotice() {
  return (
    <div
      role="note"
      style={{
        padding: '12px 16px',
        marginBottom: 16,
        background: 'var(--color-petrol-light, #e7f0f2)',
        borderLeft: '4px solid var(--color-petrol, #1f5e6d)',
        borderRadius: 4,
        fontSize: 14,
      }}
    >
      <strong>Datenschutz:</strong> Bitte schreib generisch — keine Namen,
      Initialen oder Personen-Bezüge (auch nicht von Bewohner:innen,
      Kolleg:innen oder Arbeitgebern). Wenn dein Beitrag angenommen wird,
      landet er öffentlich auf GitHub.
    </div>
  );
}
