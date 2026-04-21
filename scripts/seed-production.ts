import { db } from '../lib/db'
import { tenants, heuristics, guidelines } from '../lib/db/schema'

const TENANT_ID = '00000000-0000-0000-0000-000000000000'

const HEURISTICS_DATA = [
  // Brand Voice & Messaging
  { category: 'Brand Voice & Messaging', rule: 'Use active voice and direct language', weight: 1.0 },
  { category: 'Brand Voice & Messaging', rule: 'Avoid jargon and complex terminology unless necessary', weight: 0.9 },
  { category: 'Brand Voice & Messaging', rule: 'Maintain a professional yet approachable tone', weight: 0.8 },
  { category: 'Brand Voice & Messaging', rule: 'Use "you" to address the reader directly', weight: 0.7 },
  
  // Entity Formation Standards
  { category: 'Entity Formation Standards', rule: 'Clearly explain LLC formation requirements', weight: 1.0 },
  { category: 'Entity Formation Standards', rule: 'Include state-specific information when relevant', weight: 0.9 },
  { category: 'Entity Formation Standards', rule: 'Provide step-by-step guidance for complex processes', weight: 0.9 },
  { category: 'Entity Formation Standards', rule: 'Reference official sources and regulations', weight: 0.8 },
  { category: 'Entity Formation Standards', rule: 'Explain filing requirements and deadlines', weight: 0.8 },
  
  // Target Audience Alignment
  { category: 'Target Audience Alignment', rule: 'Address small business owners and entrepreneurs', weight: 1.0 },
  { category: 'Target Audience Alignment', rule: 'Use practical examples and real-world scenarios', weight: 0.9 },
  { category: 'Target Audience Alignment', rule: 'Explain complex topics in simple terms', weight: 0.9 },
  { category: 'Target Audience Alignment', rule: 'Provide clear next steps and actionable advice', weight: 0.8 },
  { category: 'Target Audience Alignment', rule: 'Anticipate common questions and concerns', weight: 0.7 },
  
  // SEO & Readability
  { category: 'SEO & Readability', rule: 'Use clear, descriptive headings (H1, H2, H3)', weight: 0.9 },
  { category: 'SEO & Readability', rule: 'Keep paragraphs short (3-4 sentences max)', weight: 0.8 },
  { category: 'SEO & Readability', rule: 'Use bullet points and lists for easy scanning', weight: 0.8 },
  { category: 'SEO & Readability', rule: 'Include relevant keywords naturally', weight: 0.7 },
  { category: 'SEO & Readability', rule: 'Write meta descriptions that summarize content', weight: 0.7 },
  
  // Compliance & Accuracy
  { category: 'Compliance & Accuracy', rule: 'Ensure all legal information is current and accurate', weight: 1.0 },
  { category: 'Compliance & Accuracy', rule: 'Include disclaimers where appropriate', weight: 0.9 },
  { category: 'Compliance & Accuracy', rule: 'Cite sources for statistics and claims', weight: 0.8 },
  { category: 'Compliance & Accuracy', rule: 'Avoid making guarantees or promises', weight: 0.8 },
  
  // Call-to-Action
  { category: 'Call-to-Action', rule: 'Include clear CTAs that guide the reader', weight: 0.8 },
  { category: 'Call-to-Action', rule: 'Link to relevant NCH services when appropriate', weight: 0.7 },
  { category: 'Call-to-Action', rule: 'Provide contact information for further assistance', weight: 0.6 },
]

async function seed() {
  console.log('🌱 Seeding production database...')

  try {
    // Check if database is available
    if (!db) {
      console.error('❌ Database not available')
      process.exit(1)
    }

    // Create/verify tenant
    console.log('Creating default tenant...')
    await db
      .insert(tenants)
      .values({
        id: TENANT_ID,
        name: 'NCH Inc.',
        slug: 'default',
      })
      .onConflictDoNothing()

    console.log('✓ Tenant ready')

    // Insert heuristics
    console.log(`\nInserting ${HEURISTICS_DATA.length} heuristics...`)
    
    for (const heuristic of HEURISTICS_DATA) {
      await db
        .insert(heuristics)
        .values({
          tenantId: TENANT_ID,
          category: heuristic.category,
          rule: heuristic.rule,
          weight: heuristic.weight,
        })
        .onConflictDoNothing()
    }

    console.log(`✓ Inserted ${HEURISTICS_DATA.length} heuristics`)

    // Insert guideline
    console.log('\nInserting guideline document...')
    const guidelineText = `NCH Inc. Brand Guidelines

Brand Voice & Messaging:
- Use active voice and direct language
- Avoid jargon and complex terminology unless necessary
- Maintain a professional yet approachable tone
- Use "you" to address the reader directly

Entity Formation Standards:
- Clearly explain LLC formation requirements
- Include state-specific information when relevant
- Provide step-by-step guidance for complex processes
- Reference official sources and regulations
- Explain filing requirements and deadlines

Target Audience Alignment:
- Address small business owners and entrepreneurs
- Use practical examples and real-world scenarios
- Explain complex topics in simple terms
- Provide clear next steps and actionable advice
- Anticipate common questions and concerns

SEO & Readability:
- Use clear, descriptive headings (H1, H2, H3)
- Keep paragraphs short (3-4 sentences max)
- Use bullet points and lists for easy scanning
- Include relevant keywords naturally
- Write meta descriptions that summarize content

Compliance & Accuracy:
- Ensure all legal information is current and accurate
- Include disclaimers where appropriate
- Cite sources for statistics and claims
- Avoid making guarantees or promises

Call-to-Action:
- Include clear CTAs that guide the reader
- Link to relevant NCH services when appropriate
- Provide contact information for further assistance`

    await db
      .insert(guidelines)
      .values({
        tenantId: TENANT_ID,
        filename: 'NCH Brand Guidelines.docx',
        rawText: guidelineText,
      })
      .onConflictDoNothing()

    console.log('✓ Inserted guideline document')

    console.log('\n✅ Production database seeded successfully!')
    console.log(`\nSummary:`)
    console.log(`  - Tenant: NCH Inc.`)
    console.log(`  - Heuristics: ${HEURISTICS_DATA.length}`)
    console.log(`  - Guidelines: 1`)
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
