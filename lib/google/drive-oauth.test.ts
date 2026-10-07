import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildConnectUrl, canReadSheets, classifyDriveError, classifySheetsError, CONNECT_SCOPES, driveRedirectUri, gidFrom, idTokenEmail, multipartDocBody, SHEETS_READ_SCOPE } from './drive-oauth'

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`

test('connect URL asks for offline drive.file access for the signed-in person', () => {
  const u = new URL(buildConnectUrl({ clientId: 'cid', redirectUri: driveRedirectUri('https://poe.vill.ar/'), state: 's1', loginHint: 'a@growth-rocket.com', hostedDomain: 'growth-rocket.com' }))
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(u.searchParams.get('redirect_uri'), 'https://poe.vill.ar/api/google/drive/callback')
  assert.equal(u.searchParams.get('access_type'), 'offline')
  assert.equal(u.searchParams.get('prompt'), 'consent')
  assert.equal(u.searchParams.get('scope'), CONNECT_SCOPES)
  assert.ok(CONNECT_SCOPES.includes('https://www.googleapis.com/auth/drive.file'))
  assert.ok(!CONNECT_SCOPES.includes('auth/drive '), 'never the full drive scope')
  assert.equal(u.searchParams.get('state'), 's1')
  assert.equal(u.searchParams.get('login_hint'), 'a@growth-rocket.com')
  assert.equal(u.searchParams.get('hd'), 'growth-rocket.com')
})

test('id_token email: lowercased, rejected when unverified or malformed', () => {
  assert.equal(idTokenEmail(jwt({ email: 'Mike@Growth-Rocket.com', email_verified: true })), 'mike@growth-rocket.com')
  assert.equal(idTokenEmail(jwt({ email: 'x@y.com', email_verified: false })), null)
  assert.equal(idTokenEmail('not-a-jwt'), null)
  assert.equal(idTokenEmail(undefined), null)
})

test('multipart body: Doc metadata then the HTML, closed by the boundary', () => {
  const body = multipartDocBody('My "title"', '<h1>Hi</h1>', 'b1')
  assert.ok(body.startsWith('--b1\r\nContent-Type: application/json'))
  assert.ok(body.includes('"mimeType":"application/vnd.google-apps.document"'))
  assert.ok(body.includes('"name":"My \\"title\\""'))
  assert.ok(body.includes('Content-Type: text/html; charset=UTF-8\r\n\r\n<h1>Hi</h1>'))
  assert.ok(body.endsWith('\r\n--b1--'))
})

test('Drive errors map to actionable codes', () => {
  assert.equal(classifyDriveError(403, { error: { errors: [{ reason: 'accessNotConfigured' }] } }).code, 'DRIVE_API_DISABLED')
  assert.equal(classifyDriveError(403, { error: { details: [{ reason: 'SERVICE_DISABLED' }] } }).code, 'DRIVE_API_DISABLED')
  assert.equal(classifyDriveError(401, null).code, 'DRIVE_NOT_CONNECTED')
  assert.equal(classifyDriveError(403, { error: { errors: [{ reason: 'storageQuotaExceeded' }] } }).code, 'DRIVE_FULL')
  const other = classifyDriveError(500, { error: { message: 'Backend Error' } })
  assert.deepEqual(other, { code: 'DRIVE_ERROR', message: 'Backend Error' })
})

test('DR-018: connect asks for read-only Sheets; older connections without it are detected', () => {
  assert.ok(CONNECT_SCOPES.split(' ').includes(SHEETS_READ_SCOPE))
  assert.ok(!CONNECT_SCOPES.split(' ').includes('https://www.googleapis.com/auth/spreadsheets'), 'never write access')
  assert.equal(canReadSheets(`openid email https://www.googleapis.com/auth/drive.file ${SHEETS_READ_SCOPE}`), true)
  assert.equal(canReadSheets('openid email https://www.googleapis.com/auth/drive.file'), false)
  assert.equal(canReadSheets(null), false)
})

test('DR-018: the tab comes from the link gid', () => {
  assert.equal(gidFrom('https://docs.google.com/spreadsheets/d/abc/edit#gid=123456'), 123456)
  assert.equal(gidFrom('https://docs.google.com/spreadsheets/d/abc/edit?gid=0#gid=0'), 0)
  assert.equal(gidFrom('https://docs.google.com/spreadsheets/d/abc/edit'), null)
})

test('DR-018: Sheets errors say what to do', () => {
  assert.equal(classifySheetsError(403, { error: { message: 'The caller does not have permission' } }, 'a@growth-rocket.com').code, 'SHEET_NO_ACCESS')
  assert.match(classifySheetsError(403, null, 'a@growth-rocket.com').message, /as a@growth-rocket\.com/)
  assert.equal(classifySheetsError(403, { error: { message: 'Request had insufficient authentication scopes.' } }, null).code, 'SHEETS_NOT_CONNECTED')
  assert.equal(classifySheetsError(403, { error: { details: [{ reason: 'SERVICE_DISABLED' }] } }, null).code, 'SHEETS_API_DISABLED')
  assert.equal(classifySheetsError(404, null, null).code, 'SHEET_NOT_FOUND')
  assert.equal(classifySheetsError(401, null, null).code, 'SHEETS_NOT_CONNECTED')
})
