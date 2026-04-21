'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Plus, Pencil, Trash2, X, FileText } from 'lucide-react'
import { CategoryBadge, CategoryType } from '@/components/CategoryBadge'
import { PageErrorBoundary } from '@/components/feedback/PageErrorBoundary'

interface Rule {
  id: string
  category: CategoryType
  text: string
  weight: number
  active: boolean
}

const INITIAL_RULES: Rule[] = [
  {
    id: '1',
    category: 'Brand',
    text: 'All articles must open with a verified statistic',
    weight: 9,
    active: true,
  },
  {
    id: '2',
    category: 'Blacklist',
    text: 'Never mention LegalZoom, Incfile, or ZenBusiness',
    weight: 10,
    active: true,
  },
  {
    id: '3',
    category: 'SEO',
    text: 'H2 headings must be phrased as questions for PAA',
    weight: 8,
    active: true,
  },
  {
    id: '4',
    category: 'Brand',
    text: 'CTAs must use active voice imperative verbs',
    weight: 7,
    active: true,
  },
  {
    id: '5',
    category: 'Agency',
    text: 'Content must cite at least 2 authoritative sources',
    weight: 6,
    active: true,
  },
  {
    id: '6',
    category: 'Client',
    text: 'Nevada-specific content must reference NRS statutes',
    weight: 8,
    active: true,
  },
]

export default function GuidelinesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('All')

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
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

  return (
    <PageErrorBoundary>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="p-10 max-w-6xl mx-auto"
      >
        {/* Upload Section */}
        <motion.div variants={itemVariants} className="glass-card p-8 mb-10">
          <h2 className="text-2xl font-display text-heading mb-6">
            Ingest New Guidelines
          </h2>

          <div className="relative rounded-card p-[1px] overflow-hidden mb-6 group cursor-pointer">
            <div className="absolute inset-0 dashed-border-animated opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-background/80 backdrop-blur-sm rounded-card p-10 flex flex-col items-center justify-center text-center m-[1px]">
              <div className="w-14 h-14 bg-surface border border-border rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Upload className="w-6 h-6 text-muted group-hover:text-accent transition-colors" />
              </div>
              <p className="text-heading font-medium mb-1 text-lg">
                Drop brand guidelines here
              </p>
              <p className="text-sm text-muted">Supports PDF, DOCX, TXT</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted font-medium uppercase tracking-wider">
              OR
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <textarea
            placeholder="Paste a brand directive or rule..."
            className="w-full bg-surface border border-border rounded-input p-4 text-sm text-body focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 min-h-[120px] mb-6 resize-none transition-all"
          />

          <div className="flex justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium transition-all hover:shadow-glow-accent-strong"
            >
              Analyze & Extract Rules
            </button>
          </div>
        </motion.div>

        {/* Heuristic Store */}
        <motion.div variants={itemVariants} className="glass-card overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between bg-surface">
            <div>
              <h2 className="text-xl font-display text-heading">
                Heuristic Store — NCH Inc.
              </h2>
              <p className="text-sm text-muted mt-1">
                Manage scoring rules and weights
              </p>
            </div>
            <button className="bg-surface border border-border hover:bg-surface-hover text-heading px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-colors">
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>

          <div className="px-6 py-4 border-b border-border flex gap-2 overflow-x-auto">
            {['All', 'Brand', 'SEO', 'Blacklist', 'Agency', 'Client'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-surface-hover text-heading border border-border'
                    : 'text-muted hover:text-body border border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <motion.tbody
                variants={containerVariants}
                className="divide-y divide-border"
              >
                {INITIAL_RULES.map((rule) => (
                  <motion.tr
                    variants={itemVariants}
                    key={rule.id}
                    className={`group hover:bg-surface-hover transition-colors relative ${
                      !rule.active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-6 py-5 w-[100px] pl-8">
                      <CategoryBadge category={rule.category} variant="outline" />
                    </td>
                    <td className="px-6 py-5 text-sm text-heading font-medium">
                      {rule.text}
                    </td>
                    <td className="px-6 py-5 w-[100px]">
                      <div className="bg-surface border border-border rounded px-2 py-1 text-xs font-mono text-center inline-block text-muted tabular-nums">
                        W: {rule.weight}
                      </div>
                    </td>
                    <td className="px-6 py-5 w-[80px]">
                      <div
                        className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${
                          rule.active ? 'bg-accent shadow-glow-accent' : 'bg-border'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${
                            rule.active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5 w-[100px] text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-muted hover:text-heading transition-colors rounded hover:bg-surface-hover">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-muted hover:text-danger transition-colors rounded hover:bg-surface-hover">
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

        {/* Ingestion Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 backdrop-blur-sm"
                style={{ background: 'var(--color-modal-backdrop)' }}
                onClick={() => setIsModalOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                  transition: {
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                  },
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  y: 20,
                }}
                className="relative glass-card w-full max-w-[720px] shadow-2xl flex flex-col max-h-[85vh] bg-surface"
              >
                <div className="p-6 border-b border-border flex items-start justify-between shrink-0">
                  <div>
                    <h2 className="text-2xl font-display text-heading">
                      Review Extracted Heuristics
                    </h2>
                    <p className="text-sm text-muted mt-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Claude extracted 18 rules from &apos;NCH Brand Guidelines v3.pdf&apos;.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-muted hover:text-heading hover:bg-surface-hover rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <p className="text-sm text-muted mb-4">Extracted rules would appear here...</p>
                </div>

                <div className="p-6 border-t border-border bg-surface flex items-center justify-between shrink-0 rounded-b-card">
                  <span className="text-sm text-muted font-medium">
                    18 heuristics extracted
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-muted hover:text-heading transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-input text-sm font-medium transition-all hover:shadow-glow-accent-strong"
                    >
                      Save 18 Heuristics
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageErrorBoundary>
  )
}
