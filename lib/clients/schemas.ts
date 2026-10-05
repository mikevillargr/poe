import { z } from 'zod'

const RESERVED_SLUGS = new Set(['new', 'admin', 'settings', 'api', 'login', 'pending', 'c'])

export const clientSlugSchema = z
  .string()
  .min(2, 'Slug must be at least 2 characters.')
  .max(48, 'Slug must be at most 48 characters.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.')
  .refine((s) => !RESERVED_SLUGS.has(s), 'That slug is reserved.')

export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  slug: clientSlugSchema,
  website: z.string().trim().url('Enter a full URL, e.g. https://example.com').max(300).optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional(),
})
export type CreateClientInput = z.infer<typeof createClientSchema>

export interface ClientSummary {
  id: string
  name: string
  slug: string
  website: string | null
  articleCount: number
  createdAt: string
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
}
