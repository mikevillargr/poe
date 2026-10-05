import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: distinct heuristic categories. Replacement owner: WS optimize.
export const { GET, POST, PUT, PATCH, DELETE } = gone('/api/clients/[clientId]/guidelines')
