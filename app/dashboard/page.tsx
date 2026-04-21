'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, AlertCircle, Plus, Eye, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CategoryBadge, CategoryType } from '@/components/CategoryBadge'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'

interface Job {
  id: string
  title: string
  score: number
  dimensions: CategoryType[]
  date: string
}

const RECENT_JOBS: Job[] = [
  {
    id: '1',
    title: 'Nevada LLC Formation Guide',
    score: 91,
    dimensions: ['Brand', 'SEO'],
    date: 'Apr 14',
  },
  {
    id: '2',
    title: 'Dog Bite Compensation Calculator',
    score: 74,
    dimensions: ['SEO', 'Agency'],
    date: 'Apr 13',
  },
  {
    id: '3',
    title: 'Texas Registered Agent Requirements',
    score: 62,
    dimensions: ['Brand', 'Blacklist', 'SEO'],
    date: 'Apr 12',
  },
  {
    id: '4',
    title: 'Personal Injury Settlement Timeline',
    score: 88,
    dimensions: ['Agency'],
    date: 'Apr 11',
  },
  {
    id: '5',
    title: 'Wyoming Business Formation Benefits',
    score: 55,
    dimensions: ['Brand', 'SEO', 'Blacklist'],
    date: 'Apr 10',
  },
  {
    id: '6',
    title: 'Corporate Veil Protection Strategies',
    score: 79,
    dimensions: ['Brand', 'Client'],
    date: 'Apr 9',
  },
  {
    id: '7',
    title: 'Annual Report Filing Deadlines',
    score: 93,
    dimensions: ['SEO', 'Agency'],
    date: 'Apr 8',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
}

export default function JobQueuePage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [stats, setStats] = useState({
    scoredThisWeek: 0,
    averageScore: 0,
    flaggedIssues: 0,
  })

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/documents')
      if (response.ok) {
        const { documents } = await response.json()
        
        // Filter to only scored documents
        const scoredDocs = documents.filter((d: any) => d.status === 'scored' && d.overallScore !== null)
        setJobs(scoredDocs)

        // Calculate stats
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const scoredThisWeek = scoredDocs.filter((d: any) => new Date(d.updatedAt) > weekAgo).length
        const avgScore = scoredDocs.length > 0 
          ? Math.round(scoredDocs.reduce((sum: number, d: any) => sum + d.overallScore, 0) / scoredDocs.length)
          : 0
        const flagged = scoredDocs.filter((d: any) => d.overallScore < 70).length

        setStats({
          scoredThisWeek,
          averageScore: avgScore,
          flaggedIssues: flagged,
        })
      }
    } catch (e) {
      console.error('Failed to load jobs:', e)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'bg-success/20 text-green-400 border border-success/30'
    if (score >= 70) return 'bg-warning/20 text-orange-400 border border-warning/30'
    return 'bg-danger/20 text-red-400 border border-danger/30'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleOpenJob = (documentId: string) => {
    // Navigate to analyze page with document ID as query param
    router.push(`/analyze?doc=${documentId}`)
  }

  const handleDeleteJob = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        // Remove from local state
        setJobs(jobs.filter(j => j.id !== documentId))
        setDeleteConfirm(null)
        // Reload to update stats
        loadJobs()
      }
    } catch (e) {
      console.error('Failed to delete job:', e)
    }
  }

  return (
    <PageErrorBoundary>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="p-10 max-w-7xl mx-auto"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-10">
          <h1 className="text-3xl font-display text-heading">Job Queue</h1>
          <Link
            href="/analyze"
            className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all hover:shadow-glow-accent-strong"
          >
            <Plus className="w-4 h-4" />
            New Analysis
          </Link>
        </motion.div>

        {/* Metrics Row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <div className="glass-card p-6 border-t-2 border-t-accent relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-muted text-sm font-medium">Scored This Week</h3>
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-mono font-bold text-heading tabular-nums">
                {stats.scoredThisWeek}
              </span>
            </div>
          </div>

          <div className="glass-card p-6 border-t-2 border-t-success relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-muted text-sm font-medium">Average Score</h3>
              <div className="w-2 h-2 rounded-full bg-success shadow-glow-success" />
            </div>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-mono font-bold text-success tabular-nums drop-shadow-[0_0_8px_rgba(39,103,73,0.4)]">
                {stats.averageScore}
              </span>
              <span className="text-muted text-sm font-mono mb-1">/100</span>
            </div>
          </div>

          <div className="glass-card p-6 border-t-2 border-t-danger relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h3 className="text-muted text-sm font-medium">Flagged Issues</h3>
              <AlertCircle className="w-4 h-4 text-danger drop-shadow-[0_0_4px_rgba(155,44,44,0.5)]" />
            </div>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-4xl font-mono font-bold text-danger tabular-nums drop-shadow-[0_0_8px_rgba(155,44,44,0.4)]">
                {stats.flaggedIssues}
              </span>
              <span className="text-muted text-sm mb-1">requires review</span>
            </div>
          </div>
        </motion.div>

        {/* Recent Jobs Table */}
        <motion.div variants={itemVariants} className="mb-6">
          <h2 className="text-xl font-display text-heading mb-6">
            Scored Content ({jobs.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[10%]" />
                <col className="w-[25%]" />
                <col className="w-[15%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border pl-6">
                    Content Title
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
                    Score
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
                    Categories
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider border-b border-border">
                    Scored
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-muted uppercase tracking-wider text-right border-b border-border" />
                </tr>
              </thead>
              <motion.tbody
                variants={containerVariants}
                className="divide-y divide-border"
              >
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted">
                      Loading jobs...
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted">
                      No scored content yet. Start analyzing content to see jobs here.
                    </td>
                  </tr>
                ) : jobs.map((job) => (
                  <motion.tr
                    variants={itemVariants}
                    key={job.id}
                    className="group hover:bg-surface-hover transition-colors relative cursor-pointer"
                    onClick={() => handleOpenJob(job.id)}
                  >
                    <td className="px-4 py-4 text-sm font-medium text-heading pl-6 truncate relative">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent opacity-0 group-hover:opacity-100 transition-opacity shadow-glow-accent" />
                      <span className="hover:text-accent transition-colors">
                        {job.title}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-mono font-bold tabular-nums ${getScoreColor(job.overallScore)}`}
                      >
                        {job.overallScore}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {job.dimensionScores && job.dimensionScores.length > 0 ? (
                          job.dimensionScores.slice(0, 3).map((dim: any) => (
                            <CategoryBadge key={dim.category} category={dim.category} variant="outline" />
                          ))
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                        {job.dimensionScores && job.dimensionScores.length > 3 && (
                          <span className="text-xs text-muted">+{job.dimensionScores.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted font-mono">
                      {formatDate(job.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenJob(job.id)
                          }}
                          className="text-muted hover:text-accent transition-colors p-1.5 rounded hover:bg-surface"
                          title="Open in editor"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirm(job.id)
                          }}
                          className="text-muted hover:text-danger transition-colors p-1.5 rounded hover:bg-surface"
                          title="Delete job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-display text-heading mb-2">Delete Job?</h3>
              <p className="text-sm text-muted mb-6">
                This will permanently delete this scored content and all associated data. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-input text-sm font-medium text-body hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteJob(deleteConfirm)}
                  className="px-4 py-2 rounded-input text-sm font-medium bg-danger hover:bg-danger/90 text-white transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageErrorBoundary>
  )
}
