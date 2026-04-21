import { db } from '../lib/db'
import { tenants, users } from '../lib/db/schema'
import bcrypt from 'bcryptjs'

async function seed() {
  console.log('🌱 Seeding database...')

  try {
    // Check if database is available
    if (!db) {
      console.error('❌ Database not available. Set DATABASE_URL in .env.local')
      process.exit(1)
    }

    // Create default tenant
    console.log('Creating default tenant...')
    const [tenant] = await db
      .insert(tenants)
      .values({
        name: 'Default Organization',
        slug: 'default',
      })
      .returning()
      .catch((err) => {
        if (err.code === '23505') {
          // Unique violation - tenant already exists
          console.log('✓ Default tenant already exists')
          return []
        }
        throw err
      })

    if (tenant) {
      console.log(`✓ Created tenant: ${tenant.name}`)
    }

    // Create default admin user
    console.log('Creating default admin user...')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    const [user] = await db
      .insert(users)
      .values({
        tenantId: tenant?.id || '00000000-0000-0000-0000-000000000000',
        username: 'admin',
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: hashedPassword,
      })
      .returning()
      .catch((err) => {
        if (err.code === '23505') {
          // Unique violation - user already exists
          console.log('✓ Default admin user already exists')
          return []
        }
        throw err
      })

    if (user) {
      console.log(`✓ Created user: ${user.username}`)
      console.log(`  Email: ${user.email}`)
      console.log(`  Password: admin123`)
      console.log(`  ⚠️  Change this password in production!`)
    }

    console.log('\n✅ Database seeded successfully!')
    console.log('\nYou can now:')
    console.log('  1. Run: npm run dev')
    console.log('  2. Login with: admin / admin123')
    console.log('  3. View database: npm run db:studio')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

seed()
