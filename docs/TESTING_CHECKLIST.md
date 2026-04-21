# Testing Checklist - Full App Functionality

Use this checklist to verify all features are working end-to-end.

## Prerequisites

- [ ] PostgreSQL running (or using in-memory storage)
- [ ] `.env.local` configured with `ANTHROPIC_API_KEY`
- [ ] Dev server running: `npm run dev`
- [ ] At least one guideline document ingested

## 1. Guidelines Ingest

### Upload DOCX File
- [ ] Navigate to `/guidelines`
- [ ] Click "Upload File" tab
- [ ] Select a DOCX file
- [ ] File uploads and shows name/size
- [ ] Processing screen appears automatically
- [ ] AI extracts heuristics (wait 10-30 seconds)
- [ ] Review screen shows discovered dimensions
- [ ] Review screen shows extracted heuristics with categories
- [ ] Can edit heuristic text
- [ ] Can delete unwanted heuristics
- [ ] Click "Save All"
- [ ] Success message appears
- [ ] Heuristics appear in "Heuristic Store" section below
- [ ] Can filter heuristics by category

### Google Docs URL
- [ ] Click "URL or Google Docs" tab
- [ ] Paste a public Google Docs URL
- [ ] Click "Extract Heuristics"
- [ ] Processing screen appears
- [ ] AI extracts heuristics
- [ ] Review and save works same as file upload

### Paste Text
- [ ] Click "Paste Text" tab
- [ ] Paste guideline text
- [ ] Click "Extract Heuristics"
- [ ] Processing and review work correctly

### Error Handling
- [ ] Upload non-DOCX file → Shows error
- [ ] Paste invalid Google Docs URL → Shows error
- [ ] Navigate away during processing → Can return and continue
- [ ] Save with no heuristics → Shows validation error

## 2. Content Analysis (Single Document)

### New Analysis
- [ ] Navigate to `/analyze`
- [ ] See blank canvas with placeholder
- [ ] Click "New Analysis" or paste content
- [ ] Type or paste content (minimum 50 characters)
- [ ] Click "Score" button
- [ ] Scoring completes (wait 10-30 seconds)
- [ ] Alert shows overall score and suggestion count
- [ ] Suggestions appear in right sidebar
- [ ] Can filter suggestions by category
- [ ] Can filter by "Quality" (grammar/readability)
- [ ] Can filter by "All", "Accepted", "Dismissed"

### URL Analysis
- [ ] Click "Analyze from URL"
- [ ] Paste a URL
- [ ] Content fetches and loads in editor
- [ ] Click "Score"
- [ ] Scoring works correctly

### Google Docs Analysis
- [ ] Paste Google Docs URL
- [ ] Content fetches from public doc
- [ ] Scoring works correctly

### File Upload Analysis
- [ ] Upload DOCX file
- [ ] Content parses and loads
- [ ] Scoring works correctly

## 3. Suggestions & Editing

### Accept Suggestion
- [ ] Click on a suggestion
- [ ] Text highlights in editor
- [ ] Click "Accept"
- [ ] Text replaces in editor (no unwanted quotes)
- [ ] Suggestion moves to "Accepted" filter
- [ ] Can undo acceptance

### Dismiss Suggestion
- [ ] Click "Dismiss" on a suggestion
- [ ] Suggestion moves to "Dismissed" filter
- [ ] Can undo dismissal

### Recompose Suggestion
- [ ] Click "Adjust" on a suggestion
- [ ] Recomposition modal opens
- [ ] Select a tonality preset
- [ ] Click "Regenerate"
- [ ] New version appears
- [ ] Can regenerate multiple times
- [ ] Can type custom prompt
- [ ] Click "Apply" to use new version
- [ ] Suggestion updates in list

### Quality (Grammar) Suggestions
- [ ] Type content with grammar errors
- [ ] Wait 3 seconds after stopping typing
- [ ] Quality tab shows loading indicator
- [ ] Grammar suggestions appear
- [ ] Have yellow "Quality" badge
- [ ] Can accept/dismiss like other suggestions

## 4. Version History

### Auto-Versioning
- [ ] Make edits in editor
- [ ] Versions save automatically
- [ ] Click "Saved" button (clock icon)
- [ ] Version history modal opens
- [ ] Shows list of versions with timestamps
- [ ] Shows word/character counts

### Restore Version
- [ ] Click on a previous version
- [ ] Preview shows in modal
- [ ] Click "Restore"
- [ ] Editor content reverts
- [ ] New version created for restore

### Compare Versions
- [ ] Select two versions
- [ ] Diff view shows changes
- [ ] Additions highlighted in green
- [ ] Deletions highlighted in red

## 5. Batch Processing

### CSV Upload
- [ ] Navigate to batch queue section
- [ ] Upload CSV with URLs
- [ ] Batch job starts
- [ ] Progress indicator shows
- [ ] Items process one by one
- [ ] Can see status: Queued → Scoring → Complete
- [ ] Completed items show scores
- [ ] Can view individual results
- [ ] Can download results

### Multiple URLs
- [ ] Add multiple URLs manually
- [ ] Start batch processing
- [ ] All items process correctly
- [ ] Failed items show error status

## 6. Settings

### API Key
- [ ] Navigate to `/settings`
- [ ] Enter Anthropic API key
- [ ] Click "Test API Key"
- [ ] Success message appears
- [ ] Key saves to localStorage (encrypted)
- [ ] Key persists across page refreshes

### Invalid API Key
- [ ] Enter invalid key
- [ ] Test shows error
- [ ] Scoring fails with clear error message

## 7. Database Integration

### With Database
- [ ] Set `DATABASE_URL` in `.env.local`
- [ ] Restart server
- [ ] Ingest guidelines → Saves to database
- [ ] Refresh page → Heuristics still there
- [ ] Scoring uses database heuristics
- [ ] Run `npm run db:studio` → See data in Drizzle Studio

### Without Database
- [ ] Remove `DATABASE_URL` from `.env.local`
- [ ] Restart server
- [ ] Console shows "DATABASE_URL not set, using in-memory storage"
- [ ] Ingest guidelines → Saves to memory
- [ ] Scoring works with in-memory heuristics
- [ ] Refresh page → Heuristics lost (expected)
- [ ] Warning message shows in console

## 8. Error Handling

### Network Errors
- [ ] Disconnect internet
- [ ] Try to score → Shows network error
- [ ] Try to ingest → Shows network error

### API Errors
- [ ] Use invalid API key
- [ ] Try to score → Shows API key error
- [ ] Error message is user-friendly

### Validation Errors
- [ ] Try to score empty content → Shows validation error
- [ ] Try to ingest empty file → Shows error
- [ ] Try to save zero heuristics → Shows error

## 9. UI/UX

### Responsive Design
- [ ] Resize browser window
- [ ] Layout adapts correctly
- [ ] Sidebar collapses on mobile
- [ ] All buttons accessible

### Loading States
- [ ] Scoring shows loading indicator
- [ ] Ingest shows processing animation
- [ ] Batch shows progress bars
- [ ] Buttons disable during processing

### Animations
- [ ] Suggestions slide in smoothly
- [ ] Modals fade in/out
- [ ] Highlights appear smoothly
- [ ] No janky animations

### Dark/Light Mode
- [ ] Toggle theme in settings
- [ ] All colors adapt correctly
- [ ] Text remains readable
- [ ] Badges/badges update colors

## 10. Performance

### Large Documents
- [ ] Paste 5000+ word document
- [ ] Scoring completes in reasonable time (<60s)
- [ ] Editor remains responsive
- [ ] Suggestions load smoothly

### Many Heuristics
- [ ] Ingest document with 50+ heuristics
- [ ] Scoring still works
- [ ] Filtering works smoothly
- [ ] No performance degradation

### Batch Processing
- [ ] Process 10+ URLs in batch
- [ ] All complete successfully
- [ ] Progress updates in real-time
- [ ] Results display correctly

## Issues Found

Document any issues here:

| Issue | Severity | Steps to Reproduce | Status |
|-------|----------|-------------------|--------|
| Example: Score button doesn't work | High | 1. Click Score 2. Nothing happens | Fixed |
|  |  |  |  |
|  |  |  |  |

## Sign-Off

- [ ] All critical features tested
- [ ] No blocking bugs found
- [ ] App is ready for deployment
- [ ] Documentation is up to date

**Tested by:** _________________  
**Date:** _________________  
**Version:** _________________
