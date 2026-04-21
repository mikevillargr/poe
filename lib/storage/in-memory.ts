// File-based storage for heuristics when database is not available
// Persists across server restarts, hot reloads, and page navigations

import fs from 'fs'
import path from 'path'

const STORAGE_FILE = path.join(process.cwd(), '.heuristics-store.json')

function readStore(): any[] {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Failed to read heuristics store:', err)
  }
  return []
}

function writeStore(heuristics: any[]): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(heuristics, null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed to write heuristics store:', err)
  }
}

export function getInMemoryHeuristics(): any[] {
  return readStore()
}

export function addInMemoryHeuristics(heuristics: any[]): void {
  const existing = readStore()
  writeStore([...existing, ...heuristics])
}

export function clearInMemoryHeuristics(): void {
  writeStore([])
}

export function setInMemoryHeuristics(heuristics: any[]): void {
  writeStore(heuristics)
}
