// Tables in drafts (D-002: NCH comparison/fee tables, TWS spec tables). Shared by the editor and the
// streaming preview so both keep the same schema; without these, TipTap drops <table> on load.
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'

export const tableExtensions = [Table.configure({ resizable: false }), TableRow, TableHeader, TableCell]
