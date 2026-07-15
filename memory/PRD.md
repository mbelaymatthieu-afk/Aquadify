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

## Iteration 2026-07-12 — Renommage, Points d'eau, Santé Premium, Confidentialité, AdMob
- Rename: "Coach IA"->"Aquacoach", "Analyse IA"->"Aquanalyse" partout (i18n fr/en/es, 0 occurrence restante, vérifié iteration_5).
- New: app/water-points.tsx (OpenStreetMap Overpass, permission localisation contextuelle, liste+distance+itinéraire+signalement), app/health.tsx (réservé Premium: cadenas/avantages/CTA pour gratuits, /health/connect pour Premium), app/privacy.tsx (politique de confidentialité in-app).
- New libs: src/api/waterpoints.ts, src/lib/geo.ts, src/components/WaterMap.native|web.tsx, src/lib/ads.native|web.ts.
- AdMob: init au lancement via src/lib/ads (natif only, sinon bundle web cassait), bannière déplacée sur pages secondaires (Progrès/Profil), masquée Premium.
- app.json: plugin expo-location + NSLocationWhenInUseUsageDescription.
- Deps: expo-location, react-native-maps.

## Restant / blocages App Store
- IAP Apple: Premium via Stripe = blocage 3.1.1 + "restauration achats" (StoreKit non implémenté).
- Affichage réel AdMob + ATT prompt (expo-tracking-transparency) : build natif.
- Santé réelle (HealthKit/Google Fit lecture) : libs natives + build (backend /health/* mocké).
- Android Maps: clé Google Maps API requise (iOS OK sans clé).
- Aquanalyse prod: héberger /api/insights (sinon dégradation propre).
- Politique de confidentialité: URL publique à héberger pour la fiche store.
- Suppression de compte in-app: toujours manquante (blocage 5.1.1(v)).

## Bug fix (2026-07-11) — "Network request failed" on TestFlight
- Cause: .env is git-ignored, so EAS builds had no EXPO_PUBLIC_AQUADIFY_API -> fetch to undefined URL.
- Fix: added expo.extra.aquadifyApiUrl / insightsApiUrl in app.json + src/config.ts resolving `process.env || Constants.expoConfig.extra`. client.ts & insights.ts import from src/config. Verified iteration_4.
- ACTION REQUIRED by user: rebuild the IPA (new EAS build) and upload the NEW build to TestFlight — the old build still has the bug.
- Known: extra.insightsApiUrl points at drip-track1 which lacks /api/insights -> AI insights card degrades gracefully in production until that endpoint is deployed.

## Pending (native build required)
- Google Fit / Apple Health real read (steps/activity) + hydration adaptation. Needs dev build. Backend /health/* is mocked.

## Premium AI Insights (done 2026-07-11)
- NEW endpoint POST /api/insights on the LOCAL backend (server.py) using Emergent LLM key (openai gpt-4o-mini) -> {summary, tips[3]} in fr/en/es.
- Frontend Progress tab "Analyse IA": free users see summary + 1 tip + "Passer Premium" unlock CTA; premium users see all tips + refresh. Calls LOCAL backend via EXPO_PUBLIC_BACKEND_URL. Files: src/api/insights.ts, app/(tabs)/progress.tsx.
- Verified by testing_agent iteration_3 (backend 4/4 pytest + frontend flow).

## AdMob (done 2026-07-11)
- react-native-google-mobile-ads installed; app.json plugin with App ID ca-app-pub-8009813538542789~7753483038.
- Banner unit ca-app-pub-8009813538542789/9752960414. Component src/components/AdBanner.native.tsx (guards Expo Go + premium), AdBanner.web.tsx returns null. Mounted at bottom of Today. Hidden for is_premium users. Uses TestIds in dev. Only renders on native build.
- Bundle IDs: ios com.mta.aquadify, android com.mta.aquadify. iOS NSUserTrackingUsageDescription added.


## Personas
- Health-conscious user tracking daily water intake with gentle AI coaching and gamification.

## Iteration 2026-07-12 (soir) — iOS natif : StoreKit 2, HealthKit réel, Suppression compte, ATT, ErrorBoundary
- StoreKit 2 (expo-iap 4.4.0) : premium.tsx affiche les formules Mensuel/Annuel (IDs `com.mtagency.aquadify.premium.monthly|yearly`), achat via requestPurchase + purchaseUpdatedListener, finishTransaction, restauration (restorePurchases + hasActiveSubscriptions). Après achat -> POST /iap/verify (remote, à déployer) sinon déblocage optimiste. Repli Stripe conservé sur web/Android (testID premium-subscribe-button).
- HealthKit réel (@kingstinct/react-native-healthkit 14.0.2) : health.tsx pour Premium iOS -> requestAuthorization(steps/activeEnergy/workouts), lecture du jour, objectif suggéré (suggestedGoalWithActivity dans lib/hydration.ts) + bouton Appliquer (PUT /settings). Repli mock /health/connect sur web/Android.
- Suppression de compte (App Store 5.1.1(v)) : profile.tsx Zone sensible -> Modal double confirmation -> DELETE /account (remote, à déployer). Testé web : dégrade proprement (toast erreur) car endpoint absent.
- ATT (expo-tracking-transparency) : requestTrackingPermission() avant initAds() dans _layout.tsx (natif only).
- ErrorBoundary global (src/components/ErrorBoundary.tsx) autour de _layout.
- Guards : fichiers .native/.web (iap, healthkit, tracking) -> bundle web ne charge JAMAIS les modules natifs. Vérifié testing_agent iteration_6 (frontend 16/16).
- Plugins app.json ajoutés : expo-tracking-transparency, expo-iap, @kingstinct/react-native-healthkit (+ Info.plist HealthKit). expo-dev-client installé.
- À FAIRE PAR L'UTILISATEUR : déployer les 2 endpoints (voir /app/backend/DEPLOY_TO_REMOTE.md) sur drip-track1 ; générer un build iOS (StoreKit/HealthKit/ATT/AdMob non testables en Expo Go/web) ; vérifier bundleIdentifier (com.mta.aquadify) vs préfixe produits (com.mtagency).

## Iteration 2026-07-15 — UX Premium, Notifications variées, Points d'eau Premium
- Premium (premium.tsx) : cartes Mensuel/Annuel avec prix Apple + période (perMonth/perYear), badge "Meilleure offre" sur l'annuel. Déblocage immédiat après achat (verify ou optimiste) + overlay animé PremiumSuccess (checkmark + "Félicitations, vous êtes désormais Premium !") puis retour auto (2,2s). Bouton "Restaurer les achats" rendu discret en bas de page, iOS uniquement.
- Notifications (src/lib/reminderMessages.ts) : ~26 messages variés/langue (motivation, santé, sport, chaleur, humour, conseils). scheduleHydrationReminders(s, lang) assigne un message aléatoire distinct par créneau (Fisher–Yates, réutilisation minimale). profile.tsx passe désormais `lang`.
- Points d'eau (water-points.tsx) : RÉSERVÉ Premium (carte cadenas wp-locked + CTA wp-unlock -> /premium ; cadenas aussi sur le lien Profil). Après localisation : top 3 les plus proches (déjà triés), chacun avec distance exacte + temps à pied (geo.formatWalkTime, ~5 km/h) + bouton itinéraire. Message clair si aucun point.
- Vérifié testing_agent iteration_7 (web 100%). Non testable sur web : overlay succès + variété notifs (iOS/natif).

## Backlog / Next
- P1: Apple Health / Google Fit connect (backend /health/* exists, mocked).
- P1: Edit profile (recompute goal) screen from Profil.
- P2: Streaming coach replies (/coach/chat/stream SSE).
- P2: Push notifications (remote) — only on user request + native build.
- P2: After production deploy, update EXPO_PUBLIC_AQUADIFY_API to the deployed backend URL.
