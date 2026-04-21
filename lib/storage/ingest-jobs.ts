// Persistent ingest job storage
// Jobs persist across page navigations and component unmounts

export interface IngestJob {
  id: string
  status: 'processing' | 'complete' | 'error'
  step: 'parsing' | 'extracting' | 'complete'
  inputMethod: 'upload' | 'url' | 'paste'
  fileName?: string
  url?: string
  extractedHeuristics?: any[]
  discoveredDimensions?: any[]
  error?: string
  createdAt: string
  completedAt?: string
}

// In-memory storage for ingest jobs
const ingestJobs = new Map<string, IngestJob>()

export function createIngestJob(
  inputMethod: 'upload' | 'url' | 'paste',
  fileName?: string,
  url?: string
): IngestJob {
  const job: IngestJob = {
    id: `ingest-${Date.now()}`,
    status: 'processing',
    step: 'parsing',
    inputMethod,
    fileName,
    url,
    createdAt: new Date().toISOString(),
  }
  
  ingestJobs.set(job.id, job)
  return job
}

export function getIngestJob(id: string): IngestJob | undefined {
  return ingestJobs.get(id)
}

export function updateIngestJob(id: string, updates: Partial<IngestJob>): void {
  const job = ingestJobs.get(id)
  if (job) {
    Object.assign(job, updates)
    ingestJobs.set(id, job)
  }
}

export function deleteIngestJob(id: string): void {
  ingestJobs.delete(id)
}

export function getActiveIngestJob(): IngestJob | undefined {
  // Return the most recent processing job
  const processingJobs = Array.from(ingestJobs.values())
    .filter(job => job.status === 'processing')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  return processingJobs[0]
}

export function getAllIngestJobs(): IngestJob[] {
  return Array.from(ingestJobs.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
