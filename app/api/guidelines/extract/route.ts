import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: Claude heuristic extraction from a document. Replacement owner: WS guidelines.
export const { GET, POST, PUT, PATCH, DELETE } = gone('/api/clients/[clientId]/guidelines/ingest')
