'use client'

import React from 'react'

export type CategoryType = string // Allow any category - AI discovers dimensions dynamically

interface CategoryBadgeProps {
  category: CategoryType
  className?: string
  variant?: 'outline' | 'solid'
}

export function CategoryBadge({
  category,
  className = '',
  variant = 'outline',
}: CategoryBadgeProps) {
  // Default color schemes for known categories
  const colorMap: Record<string, {
    solid: string
    outlineDark: string
    outlineLight: string
  }> = {
    'Brand': {
      solid: 'bg-badge-brand text-white',
      outlineDark: 'border-badge-brand text-badge-brand',
      outlineLight: 'border-badge-brand text-[#C23808]',
    },
    'SEO': {
      solid: 'bg-badge-seo text-white',
      outlineDark: 'border-badge-seo text-blue-400',
      outlineLight: 'border-badge-seo text-[#1E40AF]',
    },
    'Blacklist': {
      solid: 'bg-badge-blacklist text-white',
      outlineDark: 'border-badge-blacklist text-red-400',
      outlineLight: 'border-badge-blacklist text-[#991B1B]',
    },
    'Agency': {
      solid: 'bg-badge-agency text-white',
      outlineDark: 'border-badge-agency text-green-400',
      outlineLight: 'border-badge-agency text-[#166534]',
    },
    'Client': {
      solid: 'bg-badge-client text-white',
      outlineDark: 'border-badge-client text-purple-400',
      outlineLight: 'border-badge-client text-[#6B21A8]',
    },
    'Quality': {
      solid: 'bg-yellow-600 text-white',
      outlineDark: 'border-yellow-500 text-yellow-400',
      outlineLight: 'border-yellow-600 text-yellow-700',
    },
  }

  // Fallback for unknown/dynamic categories
  const defaultColors = {
    solid: 'bg-gray-600 text-white',
    outlineDark: 'border-gray-500 text-gray-400',
    outlineLight: 'border-gray-600 text-gray-700',
  }

  const colors = colorMap[category] || defaultColors

  const baseStyle =
    'inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap'
  const variantStyle =
    variant === 'solid'
      ? colors.solid
      : `border bg-transparent badge-outline-${category.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <>
      <style>{`
        .badge-outline-brand { ${colorMap.Brand.outlineDark} }
        .badge-outline-seo { ${colorMap.SEO.outlineDark} }
        .badge-outline-blacklist { ${colorMap.Blacklist.outlineDark} }
        .badge-outline-agency { ${colorMap.Agency.outlineDark} }
        .badge-outline-client { ${colorMap.Client.outlineDark} }
        .badge-outline-quality { ${colorMap.Quality.outlineDark} }

        [data-theme='light'] .badge-outline-brand { ${colorMap.Brand.outlineLight} }
        [data-theme='light'] .badge-outline-seo { ${colorMap.SEO.outlineLight} }
        [data-theme='light'] .badge-outline-blacklist { ${colorMap.Blacklist.outlineLight} }
        [data-theme='light'] .badge-outline-agency { ${colorMap.Agency.outlineLight} }
        [data-theme='light'] .badge-outline-client { ${colorMap.Client.outlineLight} }
        [data-theme='light'] .badge-outline-quality { ${colorMap.Quality.outlineLight} }
      `}</style>
      <span className={`${baseStyle} ${variantStyle} ${className}`}>
        {category}
      </span>
    </>
  )
}
