'use client'

import { createContext, useContext } from 'react'

// D-002 (DR-010): the client's content templates, for the guideline "Applies to" select and chip.
// Empty on the Universal template page (it has no templates).
export interface ScopeTemplate {
  id: string
  name: string
}

export const TemplateScopeContext = createContext<ScopeTemplate[]>([])

export const useScopeTemplates = () => useContext(TemplateScopeContext)
