import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'INR'): string {
  try {
    const isINR = currency.toUpperCase() === 'INR'
    return new Intl.NumberFormat(isINR ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: isINR ? 0 : 2,
    }).format(amount)
  } catch (e) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount)
  }
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return '—'
  const tzString = date.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop() || ''
  const dateStr = date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${dateStr} (${tzString})`
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(dateString)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getFileIcon(type: string): string {
  const icons: Record<string, string> = {
    pdf: '📄',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    psd: '🎨',
    ai: '🎨',
    zip: '🗜️',
    docx: '📝',
    pptx: '📊',
  }
  return icons[type.toLowerCase()] || '📁'
}

export function getDaysUntil(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}
