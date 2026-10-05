import { redirect } from 'next/navigation'

// Retired scoring-era route (D-001); its replacement lives under /c/[clientSlug].
export default function LegacyRoute() {
  redirect('/')
}
