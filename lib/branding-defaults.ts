// DR-021: branding defaults (pure, client-safe).

export interface Branding {
  agencyName: string
  website: string
  /** The short "About Poe" explainer on shared pages. */
  about: string
  /** Null until a logo is uploaded (the page then shows the agency name). */
  logoUrl: string | null
}

export const DEFAULT_BRANDING: Branding = {
  agencyName: 'Growth Rocket',
  website: 'https://growth-rocket.com',
  about:
    'Poe is Growth Rocket’s AI content hub. Every article starts from a brief and the SEO keywords agreed with you. ' +
    'AI researches the topic and writes a first draft; our editors then review, rewrite and check it against your brand ' +
    'and SEO guidelines before it reaches you. Every step is recorded, so you can see exactly how the piece was made.',
  logoUrl: null,
}
