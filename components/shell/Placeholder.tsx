import { Construction } from 'lucide-react'

// Stand-in for routes whose workstream hasn't landed yet. Each page names its owner.
export function Placeholder({ title, workstream, description }: { title: string; workstream: string; description: string }) {
  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-display text-heading mb-6">{title}</h1>
      <div className="glass-card p-8 flex items-start gap-4">
        <Construction className="w-6 h-6 text-accent shrink-0" />
        <div className="space-y-1">
          <p className="text-heading font-medium">Coming soon</p>
          <p className="text-muted text-sm">{description}</p>
          <p className="text-muted text-xs font-mono">workstream: {workstream}</p>
        </div>
      </div>
    </div>
  )
}
