export function EditorialDashboard({
  stats,
  recentSubmissions,
  recentArticles,
}: {
  stats: { pending: number; inReview: number; readyToPublish: number; myStack: number }
  recentSubmissions: Array<{
    id: number
    displayTitle?: string
    reviewStatus?: string
    createdAt?: string
  }>
  recentArticles: Array<{ id: number; title?: string; status?: string; updatedAt?: string }>
}) {
  const cards = [
    {
      label: 'Eingegangen',
      value: stats.pending,
      href: '/admin/collections/submissions?where[reviewStatus][equals]=pending',
    },
    {
      label: 'In Review',
      value: stats.inReview,
      href: '/admin/collections/submissions?where[reviewStatus][equals]=in_review',
    },
    {
      label: 'Bereit zur Veröffentlichung',
      value: stats.readyToPublish,
      href: '/admin/collections/articles?where[status][equals]=ready_to_publish',
    },
    {
      label: 'Mein offener Stack',
      value: stats.myStack,
      href: '/admin/collections/articles?where[status][in]=in_review,ready_to_publish',
    },
  ]
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Redaktions-Dashboard</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {cards.map((c) => (
          <a
            key={c.label}
            href={c.href}
            style={{
              display: 'block',
              padding: 16,
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: 6,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ fontSize: 32, fontWeight: 700, color: '#1f5e6d' }}>{c.value}</div>
            <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{c.label}</div>
          </a>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Aktuelle Einreichungen</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recentSubmissions.map((s) => (
              <li key={s.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <a href={`/admin/collections/submissions/${s.id}`}>
                  {s.displayTitle ?? 'Unbenannt'}
                </a>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>
                  · {s.reviewStatus}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Articles in Pipeline</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recentArticles.map((a) => (
              <li key={a.id} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                <a href={`/admin/collections/articles/${a.id}`}>{a.title ?? 'Ohne Titel'}</a>
                <span style={{ marginLeft: 8, fontSize: 12, color: '#666' }}>· {a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
