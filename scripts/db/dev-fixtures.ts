// Mock data for local development and design review. NEVER run against production.
//   npm run db:fixtures            (adds fixture clients; leaves other data alone)
//   npm run db:fixtures -- --reset (first deletes the fixture clients and fixture users)
// Refuses unless DATABASE_URL points at localhost/127.0.0.1 and NODE_ENV isn't production.
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, inArray, like } from 'drizzle-orm'
import pg from 'pg'
import * as schema from '../../lib/db/schema'
import { UNIVERSAL_TEMPLATE } from '../../lib/guidelines/universal-template'
import { requireDatabaseUrl, redact } from './env'

const {
  users,
  tenants,
  heuristics,
  universalGuidelines,
  articles,
  articleVersions,
  articleEvents,
  importBatches,
} = schema

const FIXTURE_EMAIL_DOMAIN = 'fixture.poe.test' // never a real Google domain, so these can't sign in
const DAY = 86_400_000

// ---------------------------------------------------------------------------------------------
// Universal template: the researched set lives in lib/guidelines/universal-template.ts (DR-006).
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// Clients and their content calendars
// ---------------------------------------------------------------------------------------------
type Status = 'queued' | 'draft' | 'in_review' | 'done'
interface Row {
  title: string
  brief: string
  keywords: string[]
  words: number
  status: Status
  research?: boolean
}

const CLIENTS: Array<{
  name: string
  slug: string
  website: string
  extraGuidelines: Array<{ category: string; title: string; rule: string; weight: number }>
  calendar: Row[]
}> = [
  {
    name: 'NCH Inc.',
    slug: 'nch',
    website: 'https://www.nchinc.com',
    extraGuidelines: [
      { category: 'client', title: 'Not legal advice', rule: 'Never present content as legal or tax advice. Include “consult a qualified professional” where filing decisions are discussed.', weight: 10 },
      { category: 'client', title: 'State accuracy', rule: 'Fees, deadlines and requirements are state-specific. Name the state and link the official Secretary of State page.', weight: 9 },
      { category: 'brand', title: 'NCH positioning', rule: 'Position NCH as a hands-on partner for small business owners since 1985, not a discount filing mill.', weight: 7 },
    ],
    calendar: [
      { title: 'How to Form an LLC in Nevada: A Step-by-Step Guide', brief: 'Walk first-time founders through forming a Nevada LLC: name check, articles of organization, registered agent, initial list and business license. Emphasize Nevada’s privacy and tax advantages without overstating them.', keywords: ['form an llc in nevada', 'nevada llc', 'nevada articles of organization', 'nevada registered agent'], words: 1800, status: 'done', research: true },
      { title: 'Registered Agent Requirements by State', brief: 'Explain what a registered agent does, why every LLC and corporation needs one, and how requirements differ in Nevada, Wyoming, Delaware and California.', keywords: ['registered agent requirements', 'what is a registered agent', 'registered agent service'], words: 1500, status: 'done', research: true },
      { title: 'Nevada vs. Wyoming LLC: Which Is Better for Your Business?', brief: 'Side-by-side comparison of fees, annual reports, privacy and taxes. Help readers decide based on where they actually operate.', keywords: ['nevada vs wyoming llc', 'best state to form an llc', 'wyoming llc benefits'], words: 2000, status: 'in_review', research: true },
      { title: 'What Is a Corporate Veil and How Do You Protect It?', brief: 'Define piercing the corporate veil with plain examples and list practical habits that keep personal assets protected.', keywords: ['corporate veil', 'piercing the corporate veil', 'protect personal assets llc'], words: 1400, status: 'in_review', research: true },
      { title: 'Nevada Annual List Filing: Deadlines, Fees and Penalties', brief: 'Everything an existing Nevada business owner needs to file the annual list on time, with a reminder checklist.', keywords: ['nevada annual list', 'nevada annual list filing', 'nevada business license renewal'], words: 1200, status: 'draft', research: true },
      { title: 'How to Build Business Credit for a New LLC', brief: 'Practical sequence for establishing business credit: EIN, D-U-N-S number, net-30 vendors, business credit cards. No guarantees of approval.', keywords: ['build business credit', 'business credit for new llc', 'duns number'], words: 1600, status: 'draft', research: true },
      { title: 'S Corp vs. C Corp: Tax Differences Explained', brief: 'Neutral explainer of pass-through vs. double taxation, eligibility for S corp election, and when founders should talk to a CPA.', keywords: ['s corp vs c corp', 's corp election', 'c corp taxes'], words: 1700, status: 'queued' },
      { title: 'Do You Need a Business License in Nevada?', brief: 'Clarify the state business license versus county/city licenses, with who is exempt.', keywords: ['nevada business license', 'do i need a business license'], words: 1000, status: 'queued' },
      { title: 'Series LLC: What It Is and Which States Allow It', brief: 'Introduce the series LLC structure, typical use cases (real estate, investment funds) and its limits.', keywords: ['series llc', 'what is a series llc', 'series llc states'], words: 1300, status: 'queued' },
      { title: 'How to Dissolve an LLC the Right Way', brief: 'Steps to wind down an LLC cleanly: member vote, final tax returns, articles of dissolution, and notifying creditors.', keywords: ['dissolve an llc', 'how to close an llc', 'articles of dissolution'], words: 1100, status: 'queued' },
    ],
  },
  {
    name: 'Northwind Dental',
    slug: 'northwind-dental',
    website: 'https://northwind-dental.example',
    extraGuidelines: [
      { category: 'client', title: 'Medical accuracy', rule: 'Clinical claims must match ADA guidance. Never promise outcomes or diagnose; encourage booking a consultation.', weight: 10 },
      { category: 'brand', title: 'Warm, reassuring tone', rule: 'Many readers are anxious about dental visits. Be calm and reassuring; avoid clinical jargon without a plain-English explanation.', weight: 8 },
      { category: 'agency', title: 'Local SEO', rule: 'Mention the Portland, OR service area naturally once per article and link to the booking page.', weight: 7 },
    ],
    calendar: [
      { title: 'Invisalign vs. Braces: Which Is Right for You?', brief: 'Compare clear aligners and traditional braces on cost, comfort, treatment time and which cases each suits.', keywords: ['invisalign vs braces', 'clear aligners', 'invisalign cost portland'], words: 1500, status: 'done', research: true },
      { title: 'What to Expect at Your First Dental Cleaning', brief: 'Reassuring walkthrough of a first visit for adults who haven’t seen a dentist in years.', keywords: ['first dental cleaning', 'dental cleaning what to expect', 'dentist portland'], words: 1100, status: 'in_review', research: true },
      { title: 'Dental Implants: Cost, Process and Recovery', brief: 'Plain explanation of the implant process from consultation to crown, typical timelines and what affects cost.', keywords: ['dental implants cost', 'dental implant process', 'dental implant recovery'], words: 1800, status: 'draft', research: true },
      { title: 'How to Stop Bleeding Gums', brief: 'Causes of bleeding gums, at-home steps, and when it’s a sign of gum disease that needs treatment.', keywords: ['bleeding gums', 'gum disease symptoms', 'how to stop bleeding gums'], words: 1200, status: 'queued' },
      { title: 'Teeth Whitening Options Compared', brief: 'In-office whitening vs. take-home trays vs. strips: results, sensitivity and cost.', keywords: ['teeth whitening options', 'professional teeth whitening', 'whitening sensitivity'], words: 1300, status: 'queued' },
      { title: 'Emergency Dentist: When to Go and What to Do', brief: 'Which dental problems are emergencies, first aid for a knocked-out tooth, and how to reach the practice after hours.', keywords: ['emergency dentist portland', 'dental emergency', 'knocked out tooth'], words: 1000, status: 'queued' },
    ],
  },
  {
    name: 'Brightline Fitness',
    slug: 'brightline-fitness',
    website: 'https://brightline-fitness.example',
    extraGuidelines: [
      { category: 'client', title: 'No medical claims', rule: 'Don’t claim workouts cure or treat conditions. Recommend consulting a doctor before starting a new program.', weight: 9 },
      { category: 'brand', title: 'Energetic, inclusive voice', rule: 'Upbeat and encouraging, never body-shaming. Write for beginners and returners as much as regulars.', weight: 8 },
    ],
    calendar: [
      { title: 'Beginner Strength Training Plan: 4 Weeks to Confidence', brief: 'A simple 3-days-a-week plan for complete beginners with form cues and progression rules.', keywords: ['beginner strength training plan', 'strength training for beginners', 'gym workout plan'], words: 1600, status: 'in_review', research: true },
      { title: 'HIIT vs. Steady-State Cardio', brief: 'What the research says about each, who benefits most, and how to combine them in a week.', keywords: ['hiit vs steady state cardio', 'hiit workouts', 'cardio for fat loss'], words: 1400, status: 'draft', research: true },
      { title: 'How Often Should You Work Out?', brief: 'Recommended weekly activity, rest days, and how frequency changes with goals.', keywords: ['how often should you work out', 'workout frequency', 'rest days'], words: 1100, status: 'queued' },
      { title: 'Protein Intake for Muscle Growth', brief: 'Evidence-based daily protein targets, timing myths, and easy food sources.', keywords: ['protein for muscle growth', 'how much protein per day', 'high protein foods'], words: 1300, status: 'queued' },
      { title: 'What to Bring to Your First Group Class', brief: 'Checklist and etiquette for first-timers at a group fitness class.', keywords: ['first group fitness class', 'group fitness classes near me'], words: 900, status: 'queued' },
    ],
  },
  {
    name: 'Harbor & Pine Realty',
    slug: 'harbor-pine-realty',
    website: 'https://harborandpine.example',
    extraGuidelines: [
      { category: 'client', title: 'Fair housing', rule: 'Follow Fair Housing Act language: describe properties and amenities, never the people who should live there.', weight: 10 },
    ],
    calendar: [
      { title: 'First-Time Home Buyer Checklist for Maine', brief: 'Step-by-step checklist from pre-approval to closing, with Maine-specific programs and costs.', keywords: ['first time home buyer maine', 'home buying checklist', 'maine housing programs'], words: 1700, status: 'draft', research: true },
      { title: 'How Much House Can I Afford?', brief: 'Explain debt-to-income, down payment and closing costs with a worked example.', keywords: ['how much house can i afford', 'home affordability', 'debt to income ratio'], words: 1300, status: 'queued' },
      { title: 'Selling Your Home in Winter: Tips That Work', brief: 'Pricing, staging and photography tips for listing in the off-season in coastal New England.', keywords: ['selling a house in winter', 'winter home staging'], words: 1100, status: 'queued' },
    ],
  },
]

const STAFF = [
  { name: 'Ana Santos', email: `ana.santos@${FIXTURE_EMAIL_DOMAIN}` },
  { name: 'Ben Cruz', email: `ben.cruz@${FIXTURE_EMAIL_DOMAIN}` },
  { name: 'Carla Reyes', email: `carla.reyes@${FIXTURE_EMAIL_DOMAIN}` },
]
const PENDING = [
  { name: 'Diego Lim', email: `diego.lim@${FIXTURE_EMAIL_DOMAIN}` },
  { name: 'Erin Tan', email: `erin.tan@${FIXTURE_EMAIL_DOMAIN}` },
]

// ---------------------------------------------------------------------------------------------
// Deterministic content generation
// ---------------------------------------------------------------------------------------------
function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function sectionTitles(r: Row): string[] {
  const k = r.keywords[0]
  return [
    `What ${k} means`,
    'Before you start',
    'Step by step',
    r.keywords[1] ? `A closer look at ${r.keywords[1]}` : 'Common questions',
    'Costs and timelines',
    'Mistakes to avoid',
  ]
}

function draftHtml(r: Row, variant = 0): string {
  const [primary, ...rest] = r.keywords
  const parts: string[] = [`<h1>${esc(r.title)}</h1>`]
  parts.push(
    `<p>Short answer: ${esc(primary)} comes down to a few clear decisions, and you can make most of them in an afternoon. ${esc(r.brief)}</p>`,
  )
  const sections = sectionTitles(r)
  const perSection = Math.max(2, Math.round((r.words * (variant ? 0.97 : 0.9)) / 46 / sections.length))
  sections.forEach((h, i) => {
    parts.push(`<h2>${esc(h)}</h2>`)
    for (let p = 0; p < perSection; p++) {
      const kw = rest[(i + p) % Math.max(rest.length, 1)] ?? primary
      parts.push(
        `<p>This paragraph covers one practical point about ${esc(kw)}. It explains what to check, why it matters for your situation, and what to do next. Keep the sentences short and the advice specific so the reader can act on it today.</p>`,
      )
    }
    if (i === 2) {
      parts.push(`<ul><li>Confirm the basics first.</li><li>Gather the documents you’ll need.</li><li>Set a reminder for the next deadline.</li></ul>`)
    }
  })
  parts.push(`<h2>Next steps</h2><p>If you want help with ${esc(primary)}, talk to our team. We’ll walk you through it.</p>`)
  return parts.join('\n')
}

function research(r: Row): schema.ArticleResearch {
  const host = r.keywords[0].split(' ').slice(0, 2).join('-')
  const citations = [1, 2, 3, 4].map((n) => ({
    id: String(n),
    url: `https://example.com/${host}/source-${n}`,
    title: `Reference ${n}: ${r.keywords[(n - 1) % r.keywords.length]}`,
    snippet: `Mock source ${n} summarizing current guidance on ${r.keywords[(n - 1) % r.keywords.length]}.`,
  }))
  return {
    summary: `Top-ranking pages for “${r.keywords[0]}” answer the question directly, then walk through steps, costs and common mistakes [1][2]. Searchers also look for ${r.keywords.slice(1).join(', ') || 'related terms'} [3]. Recent guidance changed in the last year, so cite current sources [4].`,
    outlineHtml: `<ol>${sectionTitles(r).map((s) => `<li>${esc(s)}</li>`).join('')}<li>Next steps</li></ol>`,
    citations,
    queries: [r.keywords[0], `${r.keywords[0]} 2026`, ...(r.keywords[1] ? [r.keywords[1]] : [])],
  }
}

function words(html: string) {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const url = requireDatabaseUrl()
  const host = new URL(url).hostname
  if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error(`Refusing to load fixtures into ${redact(url)} (local databases only).`)
    process.exit(1)
  }
  const reset = process.argv.includes('--reset')
  const pool = new pg.Pool({ connectionString: url })
  const db = drizzle(pool, { schema })

  try {
    await db.transaction(async (tx) => {
      const slugs = CLIENTS.map((c) => c.slug)
      if (reset) {
        await tx.delete(tenants).where(inArray(tenants.slug, slugs))
        await tx.delete(users).where(like(users.email, `%@${FIXTURE_EMAIL_DOMAIN}`))
        console.log('Reset: removed fixture clients and fixture users.')
      }

      // Users: fixture staff (active members) + pending requests. Real users are left untouched.
      const [admin] = await tx.select().from(users).where(eq(users.role, 'super_admin')).limit(1)
      const staff = []
      for (const s of STAFF) {
        const [u] = await tx
          .insert(users)
          .values({ ...s, status: 'active', role: 'member', approvedAt: new Date(), approvedBy: admin?.id ?? null })
          .onConflictDoUpdate({ target: users.email, set: { name: s.name } })
          .returning()
        staff.push(u)
      }
      for (const [i, p] of PENDING.entries()) {
        await tx
          .insert(users)
          .values({ ...p, status: 'pending', role: 'member', createdAt: new Date(Date.now() - (i + 1) * 3_600_000) })
          .onConflictDoNothing()
      }
      const authors = [...(admin ? [admin] : []), ...staff]

      // Universal template: only if empty, so edits made in the app survive re-runs.
      const existingUniversal = await tx.select({ id: universalGuidelines.id }).from(universalGuidelines).limit(1)
      let template = await tx.select().from(universalGuidelines)
      if (!existingUniversal.length) {
        template = await tx
          .insert(universalGuidelines)
          .values(
            UNIVERSAL_TEMPLATE.map((g, i) => ({
              ...g,
              active: g.active ?? true,
              sortOrder: (i + 1) * 1024,
              createdBy: admin?.id ?? null,
            })),
          )
          .returning()
        console.log(`Universal template: ${template.length} rules.`)
      } else {
        console.log('Universal template already present; left as is.')
      }

      for (const c of CLIENTS) {
        const [existing] = await tx.select().from(tenants).where(eq(tenants.slug, c.slug)).limit(1)
        if (existing) {
          console.log(`- ${c.name}: already exists, skipped (use --reset to rebuild).`)
          continue
        }
        const [client] = await tx
          .insert(tenants)
          .values({ name: c.name, slug: c.slug, website: c.website, createdBy: admin?.id ?? null })
          .returning()

        // Guidelines = copy of the template + client-specific manual rules.
        const copied = template.filter((g) => g.active)
        await tx.insert(heuristics).values([
          ...copied.map((g, i) => ({
            tenantId: client.id,
            category: g.category,
            title: g.title,
            rule: g.rule,
            weight: g.weight,
            source: 'template_copy' as const,
            templateId: g.id,
            sortOrder: (i + 1) * 1024,
          })),
          ...c.extraGuidelines.map((g, i) => ({
            tenantId: client.id,
            ...g,
            source: 'manual' as const,
            sortOrder: (copied.length + i + 1) * 1024,
            createdBy: authors[i % authors.length]?.id ?? null,
          })),
        ])

        // One import batch for the calendar, as if uploaded from a sheet 12 days ago.
        const importedAt = new Date(Date.now() - 12 * DAY)
        const [batch] = await tx
          .insert(importBatches)
          .values({
            tenantId: client.id,
            filename: `${c.slug}-content-calendar.xlsx`,
            rowCount: c.calendar.length,
            errors: [],
            createdBy: authors[0]?.id ?? null,
            createdAt: importedAt,
          })
          .returning()

        for (const [i, r] of c.calendar.entries()) {
          const author = authors[i % authors.length]
          const progressed = r.status !== 'queued'
          const v1 = progressed ? draftHtml(r) : null
          const v2 = r.status === 'in_review' || r.status === 'done' ? draftHtml(r, 1) : null
          const finalHtml = v2 ?? v1
          const changedAt = new Date(importedAt.getTime() + (i + 1) * DAY * 0.9)
          const [a] = await tx
            .insert(articles)
            .values({
              tenantId: client.id,
              position: (i + 1) * 1024,
              status: r.status,
              statusChangedAt: progressed ? changedAt : importedAt,
              title: r.title,
              brief: r.brief,
              primaryKeyword: r.keywords[0],
              keywords: r.keywords,
              targetWordCount: r.words,
              research: r.research ? research(r) : null,
              researchStatus: r.research ? 'ready' : 'idle',
              researchModel: r.research ? 'mock:research' : null,
              draftHtml: finalHtml,
              draftModel: progressed ? 'mock:generation' : null,
              wordCount: finalHtml ? words(finalHtml) : null,
              assigneeId: progressed ? author?.id ?? null : null,
              importBatchId: batch.id,
              createdBy: authors[0]?.id ?? null,
              updatedBy: author?.id ?? null,
              createdAt: importedAt,
              updatedAt: progressed ? changedAt : importedAt,
            })
            .returning()

          const events: Array<typeof articleEvents.$inferInsert> = [
            { articleId: a.id, tenantId: client.id, type: 'imported', toStatus: 'queued', userId: authors[0]?.id ?? null, at: importedAt, payload: { importBatchId: batch.id } },
          ]
          if (r.research) {
            events.push({ articleId: a.id, tenantId: client.id, type: 'researched', userId: author?.id ?? null, at: new Date(changedAt.getTime() - 3 * 3_600_000) })
          }
          if (v1) {
            await tx.insert(articleVersions).values({ articleId: a.id, versionNo: 1, html: v1, kind: 'generated', label: 'First draft', wordCount: words(v1), createdAt: new Date(changedAt.getTime() - 2 * 3_600_000) })
            events.push({ articleId: a.id, tenantId: client.id, type: 'generated', userId: author?.id ?? null, at: new Date(changedAt.getTime() - 2 * 3_600_000) })
            events.push({ articleId: a.id, tenantId: client.id, type: 'status_changed', fromStatus: 'queued', toStatus: 'draft', userId: author?.id ?? null, at: new Date(changedAt.getTime() - 2 * 3_600_000) })
          }
          if (v2) {
            await tx.insert(articleVersions).values({ articleId: a.id, versionNo: 2, html: v2, kind: 'manual', label: 'Editor pass', wordCount: words(v2), createdBy: author?.id ?? null, createdAt: changedAt })
            events.push({ articleId: a.id, tenantId: client.id, type: 'status_changed', fromStatus: 'draft', toStatus: 'in_review', userId: author?.id ?? null, at: changedAt })
          }
          if (r.status === 'done') {
            events.push({ articleId: a.id, tenantId: client.id, type: 'status_changed', fromStatus: 'in_review', toStatus: 'done', userId: admin?.id ?? author?.id ?? null, at: new Date(changedAt.getTime() + DAY) })
          }
          await tx.insert(articleEvents).values(events)
        }
        console.log(`- ${c.name}: ${c.calendar.length} articles, ${copied.length + c.extraGuidelines.length} guidelines.`)
      }
    })
    console.log(`Fixtures loaded into ${redact(url)}.`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
