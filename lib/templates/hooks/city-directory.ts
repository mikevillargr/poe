// FIFA World Cup blog: find the host city in the topic, then the "Links by City" directory pages that
// match the city or any detected tribe (doc: "City directory links").

import { containsWholeWord, detectAll, matchesGroup, type KeywordGroup } from '../detect'
import { UT_TRIBES } from './united-tribes'

export interface City {
  name: string
  aliases: string[]
}

/** Checked in order; first match wins. "la" is deliberately not an alias (it's a Spanish article). */
export const FIFA_CITIES: City[] = [
  { name: 'Los Angeles', aliases: ['los angeles', 'l.a.'] },
  { name: 'San Francisco', aliases: ['san francisco', 'sf', 'bay area'] },
  { name: 'Seattle', aliases: ['seattle'] },
  { name: 'Kansas City', aliases: ['kansas city'] },
  { name: 'Dallas', aliases: ['dallas'] },
  { name: 'Houston', aliases: ['houston'] },
  { name: 'Atlanta', aliases: ['atlanta'] },
  { name: 'Miami', aliases: ['miami'] },
  { name: 'Boston', aliases: ['boston'] },
  { name: 'Philadelphia', aliases: ['philadelphia'] },
  { name: 'New York', aliases: ['new york', 'nyc', 'new jersey', 'newark'] },
  { name: 'Vancouver', aliases: ['vancouver'] },
  { name: 'Toronto', aliases: ['toronto'] },
  { name: 'Monterrey', aliases: ['monterrey'] },
  { name: 'Mexico City', aliases: ['mexico city'] },
  { name: 'Guadalajara', aliases: ['guadalajara'] },
]

export const NO_DIRECTORY_LINKS = 'NO_DIRECTORY_LINKS_AVAILABLE: No matching city/tribe directory pages found.'

export function detectCity(text: string, cities: City[] = FIFA_CITIES): City | null {
  return cities.find((c) => c.aliases.some((a) => containsWholeWord(text, a))) ?? null
}

export interface DirectoryRow {
  city?: string
  tribe?: string
  url: string
  label?: string
}

export interface DirectoryPlan {
  city: string // detected city name, or "unknown"
  links: DirectoryRow[]
  text: string // {{CITY_DIRECTORY_LINKS}}
}

export function planCityDirectory(
  topic: string,
  rows: DirectoryRow[],
  cities: City[] = FIFA_CITIES,
  tribes: KeywordGroup[] = UT_TRIBES,
): DirectoryPlan {
  const city = detectCity(topic, cities)
  const found = detectAll(topic, tribes)
  const links = rows.filter((r) => {
    if (!r.url) return false
    if (city && r.city && city.aliases.some((a) => containsWholeWord(r.city!, a))) return true
    return found.some((t) => (r.tribe && matchesGroup(r.tribe, t)) || matchesGroup(r.url, t))
  })
  return {
    city: city?.name ?? 'unknown',
    links,
    text: links.length ? links.map((r) => `${r.label || r.url}: ${r.url}`).join('\n') : NO_DIRECTORY_LINKS,
  }
}
