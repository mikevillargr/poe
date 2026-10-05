#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Get version type from args or prompt
const versionType = process.argv[2] || 'patch'

// Releases are cut from a clean, up-to-date main (tag push triggers the VPS deploy)
const branch = execSync('git branch --show-current').toString().trim()
if (branch !== 'main') {
  console.error(`\n❌ Releases must be cut from main (currently on "${branch}"). Merge your branch first.\n`)
  process.exit(1)
}
if (execSync('git status --porcelain').toString().trim()) {
  console.error('\n❌ Working tree is not clean. Commit or stash changes first.\n')
  process.exit(1)
}
execSync('git fetch origin main', { stdio: 'inherit' })
if (execSync('git rev-parse HEAD').toString() !== execSync('git rev-parse origin/main').toString()) {
  console.error('\n❌ Local main is not in sync with origin/main. Pull or push first.\n')
  process.exit(1)
}

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
