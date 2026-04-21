// Shared in-memory storage for heuristics when database is not available
// This is a singleton that persists across API route calls

let inMemoryHeuristics: any[] = []

export function getInMemoryHeuristics(): any[] {
  return inMemoryHeuristics
}

export function addInMemoryHeuristics(heuristics: any[]): void {
  inMemoryHeuristics = [...inMemoryHeuristics, ...heuristics]
}

export function clearInMemoryHeuristics(): void {
  inMemoryHeuristics = []
}

export function setInMemoryHeuristics(heuristics: any[]): void {
  inMemoryHeuristics = heuristics
}
