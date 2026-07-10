# Aquadify — Mobile App (Expo) PRD

## Original problem statement
Reuse everything from the existing web app "drip-track1" (Aquadify — hydration tracking)
to build native iOS/Android apps. Reuse the EXISTING FastAPI + MongoDB backend as-is
(do not rebuild it). Auth via Google (Emergent-managed). Keep the existing design.

## Architecture
- Frontend: Expo SDK 54 + expo-router, talks to the REMOTE existing backend.
- Backend: EXISTING drip-track1 FastAPI (remote, unmodifiable).
  Base URL in frontend/.env -> EXPO_PUBLIC_AQUADIFY_API
  (https://drip-track-1.preview.emergentagent.com/api ; change to deployed URL in prod).
- Local /app/backend is unused (kept default).

## Backend endpoints reused
auth: /auth/register, /auth/login, /auth/me, /auth/logout, /auth/google/session (body {session_id})
profile/settings: PUT /profile (weight,age,sex,activity,climate -> computed goal), PUT /settings
hydration: POST /hydration/log {amount_ml,label}, GET /hydration/today, DELETE /hydration/log/{id}, GET /hydration/history
gamification: GET /gamification (streaks + badges)
coach: GET /coach/history, POST /coach/chat {message} -> {reply,used,limit,is_premium}
payments: POST /payments/checkout/session {kind:"premium",origin_url}, GET /payments/checkout/status/{id}
(Pro Marketplace /pro/*, /experts, /bookings, /admin/* intentionally NOT used — V2 dropped.)

## Implemented (2026-06-28)
- Auth screen: email/password login+register, Continue with Google (Emergent), CGU disclaimer gate, FR/EN/ES switcher. Faithful Aquadify branding (water-drop mascot, blue gradient).
- Onboarding: weight/age/sex/activity/climate -> realistic client-side goal (computeDailyGoal), pushed via /settings.
- Tabs: Aujourd'hui (today tracking + quick-add containers + custom amount + delete logs + water-drop progress), Progrès (7-day bar chart + average + days achieved + streaks + badges), Coach IA (AI chat with free-message limit + premium upsell), Profil (daily goal stepper, language, reminders, premium, logout).
- Premium: Stripe checkout via WebBrowser + status polling.
- Local hydration reminders via expo-notifications (replaces web push).
- i18n FR/EN/ES, toasts (no Alerts), keyboard handling via react-native-keyboard-controller.

## Enhancements (2026-07-10)
- New premium AI-generated app icon (assets/images/icon.png, adaptive-icon, splash, favicon) — glossy droplet.
- Redesigned in-app SVG brand mark (Mascot) to match.
- Refonte hydration fill animation: Reanimated + SVG moving waves + pop on add (WaterDropProgress).
- Realistic evidence-based daily goals (src/lib/hydration.ts, ~30 ml/kg adjusted) — lower than before.
- Backend URL switched to deployed https://drip-track-1.emergent.host/api (preview backend was sleeping).

## Pending (native build required)
- AdMob (react-native-google-mobile-ads): free-tier ads only, hidden for Premium. Needs user's App IDs + Ad Unit IDs. Not testable in Expo Go/web.
- Google Fit / Apple Health real read (steps/activity) + hydration adaptation. Needs dev build. Backend /health/* is mocked.
- Premium AI insights (personalized analysis via LLM). Planned.


## Personas
- Health-conscious user tracking daily water intake with gentle AI coaching and gamification.

## Backlog / Next
- P1: Apple Health / Google Fit connect (backend /health/* exists, mocked).
- P1: Edit profile (recompute goal) screen from Profil.
- P2: Streaming coach replies (/coach/chat/stream SSE).
- P2: Push notifications (remote) — only on user request + native build.
- P2: After production deploy, update EXPO_PUBLIC_AQUADIFY_API to the deployed backend URL.
