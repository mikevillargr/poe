// Google Drive API integration
// You'll need to set up OAuth credentials in Google Cloud Console
// and add the client ID to your environment variables

const SCOPES = 'https://www.googleapis.com/auth/drive.file'

// Get from Google Cloud Console
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''

let gapiInited = false
let gisInited = false
let tokenClient: any = null

export const initGoogleDrive = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject('Not in browser environment')
      return
    }

    // Load gapi script
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onload = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          })
          gapiInited = true
          maybeResolve()
        } catch (error) {
          reject(error)
        }
      })
    }
    document.body.appendChild(script)

    // Load GIS script
    const gisScript = document.createElement('script')
    gisScript.src = 'https://accounts.google.com/gsi/client'
    gisScript.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
      })
      gisInited = true
      maybeResolve()
    }
    document.body.appendChild(gisScript)

    function maybeResolve() {
      if (gapiInited && gisInited) {
        resolve()
      }
    }
  })
}

export const authenticateGoogleDrive = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject('Google API not initialized')
      return
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp)
        return
      }
      resolve()
    }

    if (window.gapi.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent
      tokenClient.requestAccessToken({ prompt: 'consent' })
    } else {
      // Skip display of account chooser and consent dialog for an existing session
      tokenClient.requestAccessToken({ prompt: '' })
    }
  })
}

export const createGoogleDoc = async (
  title: string,
  htmlContent: string
): Promise<string> => {
  try {
    // First, authenticate if needed
    if (!window.gapi.client.getToken()) {
      await authenticateGoogleDrive()
    }

    // Convert HTML to plain text for Google Docs
    // Google Docs API doesn't accept HTML directly, so we'll create a plain doc
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    const textContent = tempDiv.textContent || tempDiv.innerText || ''

    // Create a new Google Doc
    const fileMetadata = {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
    }

    const response = await window.gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id,webViewLink',
    })

    const fileId = response.result.id

    // Insert content into the document
    // Note: For rich formatting, you'd need to use the Google Docs API
    // For now, we'll create an empty doc and return the link
    // The user can paste content manually or we can implement full Docs API

    return response.result.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`
  } catch (error) {
    console.error('Error creating Google Doc:', error)
    throw error
  }
}

export const uploadToGoogleDrive = async (
  fileName: string,
  content: string,
  mimeType: string = 'text/html'
): Promise<string> => {
  try {
    if (!window.gapi.client.getToken()) {
      await authenticateGoogleDrive()
    }

    const boundary = '-------314159265358979323846'
    const delimiter = "\r\n--" + boundary + "\r\n"
    const close_delim = "\r\n--" + boundary + "--"

    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.google-apps.document',
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n\r\n' +
      content +
      close_delim

    const response = await window.gapi.client.request({
      path: '/upload/drive/v3/files',
      method: 'POST',
      params: { uploadType: 'multipart' },
      headers: {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"',
      },
      body: multipartRequestBody,
    })

    const fileId = response.result.id
    return `https://docs.google.com/document/d/${fileId}/edit`
  } catch (error) {
    console.error('Error uploading to Google Drive:', error)
    throw error
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    gapi: any
    google: any
  }
}
