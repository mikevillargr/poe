import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: single-suggestion rewrite. Replacement owner: WS optimize.
export const { GET, POST, PUT, PATCH, DELETE } = gone('POST /api/clients/[clientId]/articles/[articleId]/recompose')
