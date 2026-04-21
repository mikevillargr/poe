'use client'

import React from 'react'

interface ScoreGaugeProps {
  score: number
  size?: number
  className?: string
}

export function ScoreGauge({
  score,
  size = 120,
  className = '',
}: ScoreGaugeProps) {
  const strokeWidth = size * 0.1
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference

  let colorClass = 'text-success'
  let glowClass = 'drop-shadow-[0_0_8px_rgba(39,103,73,0.6)]'
  let bgGlowClass = 'from-success/10'

  if (score < 50) {
    // Red for scores below 50
    colorClass = 'text-danger'
    glowClass = 'drop-shadow-[0_0_8px_rgba(155,44,44,0.6)]'
    bgGlowClass = 'from-danger/10'
  } else if (score < 70) {
    // Yellow for scores 50-69
    colorClass = 'text-warning'
    glowClass = 'drop-shadow-[0_0_8px_rgba(146,64,14,0.6)]'
    bgGlowClass = 'from-warning/10'
  }
  // Green for scores 70+

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Subtle radial gradient background */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-radial ${bgGlowClass} to-transparent opacity-50 blur-xl`}
      ></div>

      <svg className="transform -rotate-90 w-full h-full relative z-10">
        {/* Background Arc - uses CSS variable */}
        <circle
          strokeWidth={strokeWidth}
          stroke="var(--color-gauge-bg)"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress Arc */}
        <circle
          className={`${colorClass} transition-all duration-1000 ease-out ${glowClass}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center z-20">
        <span className="font-mono text-4xl font-bold text-heading leading-none tracking-tight tabular-nums">
          {score}
        </span>
        <span className="text-xs text-muted font-mono mt-1">/100</span>
      </div>
    </div>
  )
}
