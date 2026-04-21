'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Settings,
  LogOut,
  ChevronDown,
  Feather,
  Sun,
  Moon,
} from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      path: '/analyze',
      label: 'Analyze & Optimize',
      icon: FileText,
    },
    {
      path: '/guidelines',
      label: 'Guidelines',
      icon: BookOpen,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: Settings,
    },
  ]

  return (
    <div className="w-[240px] bg-gradient-to-b from-[#0D0D14] to-[#0A0A12] border-r border-white/[0.06] h-screen fixed left-0 top-0 flex flex-col z-50">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <Feather className="w-5 h-5 text-accent mr-2 drop-shadow-[0_0_8px_rgba(232,69,10,0.5)]" />
        <span className="text-[#F1F5F9] font-display italic font-semibold text-2xl tracking-tight">
          Poe
        </span>
      </div>

      {/* Client Switcher */}
      <div className="p-4 border-b border-white/[0.06]">
        <button className="w-full flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.06] rounded-input p-2 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-accent/20 text-accent border border-accent/30 flex items-center justify-center text-xs font-bold">
              N
            </div>
            <span className="text-sm font-medium text-[#F1F5F9]">NCH Inc.</span>
          </div>
          <ChevronDown className="w-4 h-4 text-[#64748B]" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 flex flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.path
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all relative group ${
                isActive ? 'text-[#F1F5F9]' : 'text-[#64748B] hover:text-[#CBD5E1]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full shadow-glow-accent" />
              )}
              <item.icon
                className={`w-4 h-4 transition-colors ${isActive ? 'text-accent drop-shadow-[0_0_4px_rgba(232,69,10,0.3)]' : 'group-hover:text-[#CBD5E1]'}`}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="px-4 pb-4 border-b border-white/[0.06]">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.06] rounded-input p-2.5 transition-colors group"
        >
          <span className="text-sm font-medium text-[#CBD5E1] group-hover:text-[#F1F5F9]">
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <motion.div
            animate={{
              rotate: theme === 'light' ? 180 : 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
          >
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-[#64748B] group-hover:text-accent transition-colors" />
            ) : (
              <Sun className="w-4 h-4 text-accent" />
            )}
          </motion.div>
        </button>
      </div>

      {/* User Profile */}
      <div className="p-4">
        <div className="flex items-center justify-between group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-xs font-bold text-[#F1F5F9] group-hover:border-white/[0.2] transition-colors">
              MV
            </div>
            <span className="text-sm font-medium text-[#F1F5F9] group-hover:text-white transition-colors">
              Mike Villar
            </span>
          </div>
          <button className="text-[#64748B] hover:text-danger transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
