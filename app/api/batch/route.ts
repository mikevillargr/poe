import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: in-memory URL batch scoring. Replacement owner: WS import.
export const { GET, POST, PUT, PATCH, DELETE } = gone('POST /api/clients/[clientId]/articles/import')
