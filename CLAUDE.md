# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

> Note: `next.config.ts` intentionally suppresses TypeScript and ESLint build errors.

## Architecture Overview

This is a Next.js 15 App Router project for AI-powered mock interview preparation. It uses Firebase for auth/database, Vapi for voice interviews, and Google Gemini for question/feedback generation.

### Route Groups

- `app/(auth)/` — Sign-in/sign-up pages. Layout redirects to `/` if already authenticated.
- `app/(root)/` — Protected app pages. Layout enforces authentication.
  - `/` — Dashboard listing user interviews and latest community interviews
  - `/interview` — Interview creation form
  - `/interview/[id]` — Live voice interview page
  - `/interview/[id]/feedback` — Post-interview feedback and scores
- `app/api/vapi/generate/` — API route that generates questions via Gemini and saves to Firestore

### Authentication Flow

Auth is handled via Firebase Auth (email/password) + server-side session cookies using Firebase Admin SDK. There is **no `middleware.ts`** — auth checks run inside layout components via `getCurrentUser()` / `isAuthenticated()` from `lib/actions/auth.action.ts`. Pages are marked `export const dynamic = "force-dynamic"` to prevent stale caching.

### Data Layer

All backend logic lives in **Server Actions** (`"use server"`):
- `lib/actions/auth.action.ts` — sign-up, sign-in, session cookie management, `getCurrentUser()`
- `lib/actions/general.action.ts` — interview CRUD, feedback generation via Gemini

**Firestore Collections:**
- `users` — user profile (name, email, createdAt)
- `interviews` — interview metadata (role, level, techstack, questions[], userId, finalized, createdAt)
- `feedback` — AI-generated scores (totalScore, categoryScores[], strengths[], areasForImprovement[], finalAssessment)

Firebase client SDK is in `firebase/client.ts`; Admin SDK in `firebase/admin.ts`.

### AI & Voice Integration

- **Question generation**: POST to `/api/vapi/generate` → Gemini 2.0 Flash generates questions → saved to Firestore
- **Voice interviews**: `components/Agent.tsx` uses the Vapi SDK (`lib/vapi.sdk.ts`) to run real-time AI voice interviews
- **Feedback generation**: `createFeedback()` server action sends transcript to Gemini with a Zod schema for structured output (5 category scores)

### UI Stack

- **Tailwind CSS v4** (PostCSS plugin) with dark mode by default
- **ShadCN UI** (New York style) — components in `components/ui/`
- **Lucide React** icons
- **Sonner** toast notifications
- Path alias `@/*` maps to the project root

### Key Types

Defined in `types/index.d.ts`: `User`, `Interview`, `Feedback`, `AgentProps`, and parameter types for server actions. Vapi-specific types are in `types/vapi.d.ts`.

### Constants

`constants/index.ts` contains interview type mappings, tech logo mappings, and Zod schemas used for AI structured output.

## Environment Variables

Required in `.env`:
```
# Firebase Admin (server-side)
FIREBASE_PROJECT_ID
FIREBASE_PRIVATE_KEY
FIREBASE_CLIENT_EMAIL

# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID

# AI / Voice
GOOGLE_AI_API_KEY
NEXT_PUBLIC_VAPI_WEB_TOKEN
NEXT_PUBLIC_VAPI_WORKFLOW_ID
```
