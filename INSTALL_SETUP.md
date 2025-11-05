# Installation Setup Guide

This guide explains how to set up the branded install URL for Vibe Coders.

## Overview

The install script lives in this repository (`vibe-coders-desktop`), but we want users to access it via a clean branded URL:

```
vibe-coders.app/install → redirects to → raw.githubusercontent.com/.../install.sh
```

## Setting Up the Redirect

### Option 1: Next.js Route Handler (Recommended)

In your `vibe-coders` (web) repository, create a route handler:

**File:** `app/install/route.ts`

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.redirect(
    'https://raw.githubusercontent.com/papay0/vibe-coders-desktop/main/install.sh',
    { status: 307 } // Temporary redirect
  );
}
```

This creates the endpoint: `https://vibe-coders.app/install`

### Option 2: Middleware Redirect

Alternatively, add to your middleware:

**File:** `middleware.ts`

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Redirect /install to GitHub raw script
  if (request.nextUrl.pathname === '/install') {
    return NextResponse.redirect(
      'https://raw.githubusercontent.com/papay0/vibe-coders-desktop/main/install.sh',
      { status: 307 }
    );
  }

  // ... other middleware logic
}
```

### Option 3: Vercel Redirect (vercel.json)

If deploying to Vercel, add to `vercel.json`:

```json
{
  "redirects": [
    {
      "source": "/install",
      "destination": "https://raw.githubusercontent.com/papay0/vibe-coders-desktop/main/install.sh",
      "permanent": false
    }
  ]
}
```

## Testing the Setup

After deploying, test with:

```bash
# Test the redirect
curl -L vibe-coders.app/install

# Test the installation (dry run)
curl -fsSL vibe-coders.app/install | bash
```

## User-Facing Documentation

Once set up, users install with:

```bash
curl -fsSL vibe-coders.app/install | bash
```

Or use the GitHub URL directly:

```bash
curl -fsSL https://raw.githubusercontent.com/papay0/vibe-coders-desktop/main/install.sh | bash
```

## Notes

- The install script is in the `vibe-coders-desktop` repository
- The redirect is configured in the `vibe-coders` (web) repository
- Both work independently - users can use either URL
- The GitHub raw URL always works, even if your website is down

## Security

The script:
- Only installs to `~/.vibe-coders` (user directory)
- Doesn't require sudo for the app itself
- Uses official package managers (Homebrew, apt, yum)
- Is open source and auditable on GitHub

Users should always review scripts before running them:

```bash
# Review first
curl -fsSL vibe-coders.app/install

# Then install
curl -fsSL vibe-coders.app/install | bash
```
