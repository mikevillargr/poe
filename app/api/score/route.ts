import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: Claude scoring against heuristics (prompt + JSON parsing worth reusing). Replacement owner: WS optimize.
export const { GET, POST, PUT, PATCH, DELETE } = gone('POST /api/clients/[clientId]/articles/[articleId]/optimize')
