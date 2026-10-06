// Run: npx tsx --conditions=react-server --test lib/google/sheets.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { a1Range, buildAssertion, parseServiceAccountJson } from './sheets'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const keyFile = JSON.stringify({ type: 'service_account', client_email: 'poe-sheets@proj.iam.gserviceaccount.com', private_key: pem })

test('service-account key file: JSON or base64; wrong files are rejected', () => {
  assert.equal(parseServiceAccountJson(keyFile).clientEmail, 'poe-sheets@proj.iam.gserviceaccount.com')
  assert.equal(parseServiceAccountJson(Buffer.from(keyFile).toString('base64')).clientEmail, 'poe-sheets@proj.iam.gserviceaccount.com')
  assert.throws(() => parseServiceAccountJson('{"type":"authorized_user"}'), /service-account/)
  assert.throws(() => parseServiceAccountJson('not json'), /isn’t a service-account key file/)
})

test('JWT assertion: RS256-signed, read-only Sheets scope, 1 h expiry', () => {
  const jwt = buildAssertion(parseServiceAccountJson(keyFile), 1_800_000_000)
  const [h, c, sig] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'RS256', typ: 'JWT' })
  assert.deepEqual(JSON.parse(Buffer.from(c, 'base64url').toString()), {
    iss: 'poe-sheets@proj.iam.gserviceaccount.com',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: 1_800_000_000,
    exp: 1_800_003_600,
  })
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, 'base64url')))
})

test('A1 ranges quote tab names', () => {
  assert.equal(a1Range('COMMUNITY PAGE LINKS/TRIBES', 'A1:Z1000'), "'COMMUNITY PAGE LINKS/TRIBES'!A1:Z1000")
  assert.equal(a1Range("Bob's tab"), "'Bob''s tab'")
})

test('spreadsheet ids from links or bare ids', async () => {
  const { spreadsheetIdFrom } = await import('./ids')
  assert.equal(spreadsheetIdFrom('https://docs.google.com/spreadsheets/d/1LZD-qRS7OaIjFhKu_0W-OAANeASuAS3lPa7F2WjvDMU/edit#gid=1702677029'), '1LZD-qRS7OaIjFhKu_0W-OAANeASuAS3lPa7F2WjvDMU')
  assert.equal(spreadsheetIdFrom('1LZD-qRS7OaIjFhKu_0W-OAANeASuAS3lPa7F2WjvDMU'), '1LZD-qRS7OaIjFhKu_0W-OAANeASuAS3lPa7F2WjvDMU')
  assert.equal(spreadsheetIdFrom('https://example.com/not-a-sheet'), null)
})
