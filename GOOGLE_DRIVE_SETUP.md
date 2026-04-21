# Google Drive Integration Setup

This guide will help you set up Google Drive integration for exporting documents.

## Prerequisites

- A Google account
- Access to Google Cloud Console

## Step-by-Step Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "Poe Content Analyzer")
4. Click "Create"

### 2. Enable Google Drive API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### 3. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: Poe Content Analyzer
   - User support email: your email
   - Developer contact: your email
   - Scopes: Add `https://www.googleapis.com/auth/drive.file`
   - Test users: Add your email
4. Application type: "Web application"
5. Name: "Poe Web Client"
6. Authorized JavaScript origins:
   - `http://localhost:3001` (development)
   - `https://yourdomain.com` (production)
7. Authorized redirect URIs:
   - `http://localhost:3001` (development)
   - `https://yourdomain.com` (production)
8. Click "Create"

### 4. Get API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API key"
3. Copy the API key
4. (Optional) Click "Restrict Key" and limit to Google Drive API

### 5. Add Credentials to Your App

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your credentials:
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   NEXT_PUBLIC_GOOGLE_API_KEY=your-api-key
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

## How It Works

1. User clicks "Save to Google Drive" button
2. Google OAuth consent screen appears (first time only)
3. User grants permission to create files in their Drive
4. Document is uploaded as a Google Doc
5. New tab opens with the created document

## Features

- ✅ OAuth 2.0 authentication
- ✅ Creates Google Docs from HTML content
- ✅ Optional score report inclusion
- ✅ Opens document in new tab after creation
- ✅ Reuses authentication token for subsequent uploads

## Troubleshooting

### "Google API not initialized"
- Make sure you've added the credentials to `.env.local`
- Restart your dev server after adding credentials

### "Access denied" or "Invalid client"
- Check that your Client ID is correct
- Verify authorized origins match your URL exactly
- Make sure you're using `http://localhost:3001` (not `127.0.0.1`)

### OAuth consent screen not showing
- Clear browser cache and cookies
- Try in incognito mode
- Check browser console for errors

### Document created but empty
- This is expected - Google Drive API creates the doc
- Content is uploaded as HTML
- Google Docs will render the HTML content

## Security Notes

- Never commit `.env.local` to git (it's in `.gitignore`)
- API keys are public (they're in the browser)
- OAuth restricts access to only creating files (not reading existing files)
- Users must explicitly grant permission

## Production Deployment

1. Add your production domain to authorized origins
2. Update `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_API_KEY` in production environment
3. Verify OAuth consent screen is published (not in testing mode)
