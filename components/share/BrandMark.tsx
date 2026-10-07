import type { Branding } from '@/lib/branding-defaults'

// DR-021: the agency logo, or its name in the display face until a logo is uploaded.
export function BrandMark({ branding, className = 'h-7' }: { branding: Branding; className?: string }) {
  if (branding.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={branding.logoUrl} alt={branding.agencyName} className={`${className} w-auto object-contain`} />
  }
  return <span className="font-display text-xl text-heading whitespace-nowrap">{branding.agencyName}</span>
}
