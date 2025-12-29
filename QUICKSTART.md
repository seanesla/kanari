# Google Calendar Integration - Quick Start

## 5-Minute Setup Guide

### Prerequisites
- Node.js 18+ installed
- pnpm installed
- Google account

### Step 1: Install Dependencies
```bash
cd /Users/seane/Documents/Github/kanari-calendar
pnpm install
```

### Step 2: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project (or select existing)
3. Enable **Google Calendar API**:
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

4. Create OAuth credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "kanari-calendar"

5. Add authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/google/callback
   ```

6. Copy the Client ID and Client Secret

### Step 3: Configure Environment Variables

Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste your credentials:

```bash
# Replace with your actual values
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Same values with NEXT_PUBLIC_ prefix
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### Step 4: Start Development Server

```bash
pnpm dev
```

Server will start at [http://localhost:3000](http://localhost:3000)

### Step 5: Test Calendar Integration

1. **Connect Calendar:**
   - Navigate to http://localhost:3000/dashboard/settings
   - Scroll to "Calendar Integration" section
   - Click "Connect" button
   - Sign in with your Google account
   - Grant calendar permissions
   - You'll be redirected back to settings
   - Status should show "Connected" with green dot

2. **Schedule a Recovery Block:**
   - Navigate to http://localhost:3000/dashboard/suggestions
   - You'll see 3 mock suggestions
   - Click "Schedule" on any suggestion
   - Event will be created in your Google Calendar
   - Button will change to "Scheduled" with checkmark

3. **Verify in Google Calendar:**
   - Open [Google Calendar](https://calendar.google.com)
   - You should see the recovery event
   - It will have reminders at 10 and 30 minutes before

### Step 6: Disconnect (Optional)

To disconnect calendar:
- Go to Settings → Calendar Integration
- Click "Disconnect"
- Tokens will be revoked and cleared

## Troubleshooting

### "OAuth configuration missing"
- Check `.env.local` exists
- Verify all variables are set
- Restart dev server: `Ctrl+C` then `pnpm dev`

### "Redirect URI mismatch"
- Ensure redirect URI in Google Cloud Console matches exactly:
  ```
  http://localhost:3000/api/auth/google/callback
  ```
- No trailing slash
- Use http (not https) for localhost

### "Calendar API not enabled"
- Go to Google Cloud Console
- Navigate to "APIs & Services" → "Library"
- Search "Google Calendar API"
- Click "Enable"

### "Failed to schedule event"
- Make sure calendar is connected (green dot in Settings)
- Check browser console for errors (F12)
- Verify token hasn't expired (should auto-refresh)

## Next Steps

### Integration with Gemini API
Replace mock suggestions in `/app/dashboard/suggestions/page.tsx`:

```typescript
// Replace this mock data
const mockSuggestions: Suggestion[] = [...]

// With actual Gemini API call
const suggestions = await fetchSuggestionsFromGemini(voiceMetrics)
```

### Add Preferred Recovery Times
Users can set preferred times in Settings:

```typescript
const settings = {
  preferredRecoveryTimes: ["14:00", "16:00", "18:00"]
}
```

Scheduler will try these times first before finding next available slot.

### Enable Auto-Schedule
When enabled, automatically schedule recovery blocks when elevated stress is detected:

```typescript
if (settings.autoScheduleRecovery && stressLevel === "elevated") {
  await scheduleRecoveryBlock(suggestion, tokens, settings)
}
```

## File Structure

```
kanari-calendar/
├── lib/calendar/          # Calendar integration logic
│   ├── oauth.ts          # OAuth 2.0 flow
│   ├── api.ts            # Calendar API wrapper
│   └── scheduler.ts      # Scheduling logic
├── app/api/auth/google/  # OAuth endpoints
│   ├── route.ts          # Initiate flow
│   └── callback/route.ts # Handle callback
├── hooks/
│   └── use-calendar.ts   # React hook
└── components/dashboard/
    ├── settings-content.tsx    # Connect/disconnect UI
    └── suggestions/page.tsx    # Schedule buttons
```

## Documentation

- **Full Guide:** [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md)
- **Implementation Summary:** [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **This Guide:** [QUICKSTART.md](./QUICKSTART.md)

## Support

For issues or questions:
1. Check [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md) Troubleshooting section
2. Review browser console (F12) for errors
3. Check Network tab for failed API requests
4. Verify Google Cloud Console settings

## Production Deployment

Before deploying to production:

1. **Update redirect URI:**
   ```
   https://yourdomain.com/api/auth/google/callback
   ```

2. **Set environment variables** in hosting platform (Vercel, Netlify, etc.)

3. **Enable token encryption** (see [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md) Security section)

4. **Use HTTP-only cookies** instead of localStorage

5. **Add rate limiting** on API routes

6. **Implement proper logging** (not console.error)

---

**Ready to start?** Run `pnpm dev` and navigate to http://localhost:3000/dashboard/settings
