#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Get version type from args or prompt
const versionType = process.argv[2] || 'patch'

// Read package.json
const packagePath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const currentVersion = packageJson.version

console.log(`\n📦 Current version: ${currentVersion}`)
console.log(`🔖 Release type: ${versionType}\n`)

// Bump version
const newVersion = bumpVersion(currentVersion, versionType)
console.log(`✨ New version: ${newVersion}\n`)

// Update package.json
packageJson.version = newVersion
fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n')
console.log(`📝 Updated package.json\n`)

// Commit and tag
console.log('🔄 Committing and tagging...\n')

try {
  // Commit version bump
  execSync(`git add package.json`, { stdio: 'inherit' })
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' })

  // Create tag
  execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' })

  // Push commit and tag
  execSync(`git push`, { stdio: 'inherit' })
  execSync(`git push origin v${newVersion}`, { stdio: 'inherit' })

  console.log(`\n✅ Release v${newVersion} created and deployed!\n`)
  console.log(`🚀 GitHub Actions will deploy to VPS shortly.\n`)
} catch (error) {
  console.error('\n❌ Release failed:', error.message)
  process.exit(1)
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number)

  switch (type) {
    case 'major':
      parts[0]++
      parts[1] = 0
      parts[2] = 0
      break
    case 'minor':
      parts[1]++
      parts[2] = 0
      break
    case 'patch':
    default:
      parts[2]++
      break
  }

  return parts.join('.')
}
