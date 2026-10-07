// DR-021: notification sentences (pure; used in-app and as email subjects).

export type NotificationType = 'comment_added' | 'comment_reply' | 'client_approved' | 'changes_requested'

export function notificationText(type: NotificationType | string, p: Record<string, unknown>, title: string): string {
  const who = typeof p.name === 'string' && p.name ? p.name : 'Someone'
  switch (type) {
    case 'comment_added':
      return `${who} commented on “${title}”`
    case 'comment_reply':
      return `${who} replied on “${title}”`
    case 'client_approved':
      return `${who} approved “${title}”`
    case 'changes_requested':
      return `${who} requested changes to “${title}”`
    default:
      return `New activity on “${title}”`
  }
}
