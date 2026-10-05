import { Inbox, PenLine, Eye, CheckCircle2, type LucideIcon } from 'lucide-react'
import type { ArticleStatus } from '@/lib/articles/schemas'

// Visual mapping for article statuses, using the existing palette (accent / warning / success).
export const STATUS_STYLE: Record<
  ArticleStatus,
  { icon: LucideIcon; border: string; glow: string; text: string; pill: string; bar: string }
> = {
  queued: {
    icon: Inbox,
    border: 'border-t-[#64748B]',
    glow: 'from-[#64748B]/5',
    text: 'text-heading',
    pill: 'bg-[#64748B]/10 text-muted border-[#64748B]/20',
    bar: 'bg-[#64748B]',
  },
  draft: {
    icon: PenLine,
    border: 'border-t-accent',
    glow: 'from-accent/5',
    text: 'text-accent',
    pill: 'bg-accent/10 text-accent border-accent/20',
    bar: 'bg-accent',
  },
  in_review: {
    icon: Eye,
    border: 'border-t-warning',
    glow: 'from-warning/5',
    text: 'text-orange-500',
    pill: 'bg-warning/10 text-orange-500 border-warning/20',
    bar: 'bg-orange-500',
  },
  done: {
    icon: CheckCircle2,
    border: 'border-t-success',
    glow: 'from-success/5',
    text: 'text-green-500',
    pill: 'bg-success/10 text-green-500 border-success/20',
    bar: 'bg-green-500',
  },
}
