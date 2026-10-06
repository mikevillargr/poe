// The Google Sheets the n8n workflows read, as Poe sheet sources (doc: "Data source register"). Topic
// sources fill a template's queue; inventory sources fill a link inventory. `columnMap` values are header
// names, column letters or "A|B" alternatives; `urlPrefix` turns slugs into URLs. Each sheet must be
// shared with Poe's service account as a Viewer.

export interface SeedSheetSource {
  name: string
  spreadsheetId: string
  tab: string
  range?: string
  headerRow?: number
  target: 'topics' | 'inventory'
  template?: string
  inventory?: string
  columnMap: Record<string, string>
}

const VIP_FAQ_TRACKER = '1pYSUEjcfUN6wLf_HkZfLUc8kr-iebX6LjO90PK8CUjI'

function autoParts(tab: 'LFP' | 'SPP', interlinkSheet: string): SeedSheetSource[] {
  return [
    { name: `FAQ tracker (${tab} tab)`, spreadsheetId: VIP_FAQ_TRACKER, tab, headerRow: 2, target: 'topics', template: 'product-faq', columnMap: { title: 'Product Name' } },
    { name: `Products (${tab} tab, columns A–B)`, spreadsheetId: VIP_FAQ_TRACKER, tab, headerRow: 2, target: 'inventory', inventory: 'products', columnMap: { url: 'A', title: 'B' } },
    { name: `${tab} VIP interlinking sheet`, spreadsheetId: interlinkSheet, tab: 'Sheet1', target: 'inventory', inventory: 'interlink-pages', columnMap: { url: 'Live URLS|Live URLs', title: 'Page' } },
  ]
}

export const CLIENT_SHEET_SOURCES: Record<string, SeedSheetSource[]> = {
  'levittown-ford-parts': autoParts('LFP', '14On7yc4QJenYTsfzY76HFD1lRHUBUFldEsTLStsH3xI'),
  'subaru-parts-pros': autoParts('SPP', '1mwurc_J8ARc8iUBMiOhlHJzT8T3S6gwnNAXXZTP1ymU'),
  tenderbites: [
    { name: 'FAQ Copy for Express Site', spreadsheetId: '1ycwkk4IG7t1hiUhJOU_IYZWDPtkzu5ZEv8HTuDsEKIA', tab: 'Sheet1', target: 'topics', template: 'product-faq', columnMap: { title: 'Product Name|Product name' } },
    { name: 'Blog Content Tracker (topics)', spreadsheetId: '12TYf-c8FgtALFrWQkQyCHX-wrJlQ-DxgF19bYjnbLMA', tab: 'Blogs', target: 'topics', template: 'blog', columnMap: { title: 'Blog Page', brief: 'Blog summary' } },
    { name: 'Blog Content Tracker (published URLs)', spreadsheetId: '12TYf-c8FgtALFrWQkQyCHX-wrJlQ-DxgF19bYjnbLMA', tab: 'Blogs', target: 'inventory', inventory: 'blog-articles', columnMap: { url: 'Live URL|G', title: 'Blog Page' } },
  ],
  'the-watch-store-ph': [
    { name: 'FAQ Requests', spreadsheetId: '1Cw_3ePM2yiE3qcqXKFjba0u7I9YF8h2V5omt8dKb4x8', tab: 'Sheet1', target: 'topics', template: 'product-faq', columnMap: { title: 'Item|Item (A)', itemUrl: 'Item URL|Item URL (B)' } },
    { name: 'Blog Ideation Sheet', spreadsheetId: '1F7LpaaACdl5Q_tBwSBUGTQt9Y_6XYbXj8GpoEoTPzNQ', tab: 'Sheet1', target: 'topics', template: 'blog', columnMap: { title: 'Title', brief: 'Prompt', keywords: 'SEO Keywords', wordcount: 'Number of Words' } },
    { name: 'Published blog URLs', spreadsheetId: '1pu_MCrBh8biw2eqwvsdz0SwkgmNzVrqTXpD7fhaud40', tab: 'Sheet1', target: 'inventory', inventory: 'blog-articles', columnMap: { url: 'Link', title: 'Title' } },
    {
      name: 'Watch Store Product Urls',
      spreadsheetId: '1IvSZhTqLNxinkyvXbpOUILxC1a5OV46Cu1ykbYgAfXE',
      tab: 'Sheet1',
      target: 'inventory',
      inventory: 'products',
      columnMap: { url: 'URL|url|Product URL|Slug', urlPrefix: 'https://thewatchstore.ph/products/' },
    },
  ],
  nch: [
    { name: 'NCH Ideated Topics', spreadsheetId: '1LZD-qRS7OaIjFhKu_0W-OAANeASuAS3lPa7F2WjvDMU', tab: 'Sheet1', target: 'topics', template: 'blog', columnMap: { title: 'Title', brief: 'Prompt', keywords: 'SEO Keywords', wordcount: 'Number of Words' } },
    { name: 'NCH Blog Tracker (Manual Articles)', spreadsheetId: '1oALzbYS51vBjAI8Ep9k3XCAojskbQOBTUsOgAJdyug8', tab: 'Manual Articles', range: 'A1:J800', target: 'inventory', inventory: 'blog-articles', columnMap: { url: 'Live URL', title: 'TItle|Title' } },
    { name: 'NCH YouTube channel', spreadsheetId: '1a40cTDBUSTKvJdswTz3NBURnzlOVek8kg_J1LHIvNew', tab: 'NCHIncYoutubeChannel', range: 'A1:C500', target: 'inventory', inventory: 'youtube', columnMap: { url: 'url', title: 'title' } },
  ],
  'united-tribes': [
    { name: 'Blog Ideation Sheet (heritage blog)', spreadsheetId: '1fG0tvmCNdSOFEfsRVuflXycBm9Q-sbw9Xw89JXxljRE', tab: 'Sheet1', target: 'topics', template: 'blog', columnMap: { title: 'Title', brief: 'Prompt', keywords: 'SEO Keywords', wordcount: 'Number of Words' } },
    { name: 'Blog Ideation Sheet (FIFA blog)', spreadsheetId: '1fG0tvmCNdSOFEfsRVuflXycBm9Q-sbw9Xw89JXxljRE', tab: 'Sheet1', target: 'topics', template: 'fifa-blog', columnMap: { title: 'Title', brief: 'Prompt', keywords: 'SEO Keywords', wordcount: 'Number of Words' } },
    { name: 'Tribe links (community pages)', spreadsheetId: '1FWiuPvAiCpXEVR5p8x4fz3s3lJkJuczj4v3cQFoMZBU', tab: 'COMMUNITY PAGE LINKS/TRIBES', range: 'A1:Z1000', target: 'topics', template: 'tribe-page', columnMap: {} },
    { name: 'Published blog URLs', spreadsheetId: '1P8lPS9_ap_kUt2SjuG644HZel7UAGnKQexLoF0lTMW4', tab: 'Untitled', range: 'A:A', target: 'inventory', inventory: 'blog-articles', columnMap: {} },
    { name: 'FIFA blog URLs', spreadsheetId: '18ju9d7A3J-_cE5qxVdb-Z85ut6rbhYIH9GvuAiNucws', tab: 'Sheet1', target: 'inventory', inventory: 'fifa-blog-articles', columnMap: { url: 'BLOG URL' } },
    {
      name: 'Links by City',
      spreadsheetId: '1XMI6F18-z-CzVaKH0xX2suYNFPBpyykijsQmnJeFFhA',
      tab: 'Links by City',
      target: 'inventory',
      inventory: 'city-directory',
      columnMap: { url: 'Business Page URL', title: 'Business Name|label|name|page', city: 'City', tribe: 'tribe|heritage|community' },
    },
  ],
}
