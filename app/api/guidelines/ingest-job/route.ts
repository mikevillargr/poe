import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: in-memory ingestion jobs. Replacement owner: WS guidelines.
export const { GET, POST, PUT, PATCH, DELETE } = gone('/api/clients/[clientId]/guidelines/ingest')
