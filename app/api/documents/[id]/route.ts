import { gone } from '@/lib/api/gone'

// Retired (D-001). Was: scored document get/update/delete. Replacement owner: WS foundation.
export const { GET, POST, PUT, PATCH, DELETE } = gone('/api/clients/[clientId]/articles/[articleId]')
