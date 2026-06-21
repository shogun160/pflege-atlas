import { redirect } from 'next/navigation'

// V1.7.1: Während des Aufbaus zeigt die Root-Domain die Coming-Soon-Landing-Page.
// Diesen Redirect entfernen sobald genug Inhalte vorhanden sind (V1.8 oder später).
export default function HomePage() {
  redirect('/construction')
}
