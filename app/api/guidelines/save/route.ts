import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: heuristics bulk save with file fallback. Replacement owner: WS guidelines.
export const { GET, POST, PUT, PATCH, DELETE } = gone('/api/clients/[clientId]/guidelines')
