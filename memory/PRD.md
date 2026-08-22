# Aquadify — Mobile App (Expo) PRD

## Original problem statement
Reuse everything from the existing web app "drip-track1" (Aquadify — hydration tracking)
to build native iOS/Android apps. Reuse the EXISTING FastAPI + MongoDB backend as-is
(do not rebuild it). Auth via Google (Emergent-managed). Keep the existing design.

## Architecture
- Frontend: Expo SDK 54 + expo-router, talks to the REMOTE existing backend.
- Backend: EXISTING drip-track1 FastAPI (remote, unmodifiable).
  Base URL in frontend/.env -> EXPO_PUBLIC_AQUADIFY_API
  (https://aquadify-storekit.preview.emergentagent.com/api ; change to deployed URL in prod).
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

## Iteration 2026-07-16 — Essai gratuit 7j, note résiliation, robustesse abonnement annuel, audit complet
- Premium (premium.tsx) : détection de l'essai gratuit via champs iOS (`introductoryPricePaymentModeIOS` / `subscriptionInfoIOS.introductoryOffer.paymentMode` = 'free-trial') → badge vert "7 jours offerts" sur chaque plan concerné + note `trialNote` (facturation seulement à la fin de l'essai) + note `cancelNote` (résiliation via réglages compte Apple). i18n fr/en/es.
- Robustesse annuel : buy() et purchaseErrorListener affichent désormais le message d'erreur StoreKit réel (au lieu d'un générique) pour diagnostiquer l'échec annuel sur TestFlight. Le code d'achat est identique pour mensuel/annuel (requestPurchase apple.sku, type subs) → un échec annuel isolé est quasi toujours une config App Store Connect (produit annuel non "Ready to Submit", hors même groupe d'abonnement, ou intro offer manquante).
- AUDIT complet : toutes les fonctionnalités présentes — onglets index/progress(Aquanalyse)/coach(Aquacoach)/profile ; écrans water-points (Premium, top 3 + distance + temps à pied + itinéraire), health, premium, privacy, onboarding, auth. Aucune suppression.
- iap.native/web : IapProduct + champ hasFreeTrial.

## RAPPEL App Store Connect (côté utilisateur, hors code)
- Abonnement ANNUEL `com.mtagency.aquadify.premium.yearly` : doit être "Ready to Submit"/approuvé, DANS LE MÊME groupe d'abonnement que le mensuel, contrats payants actifs. Sinon fetchProducts ne le renvoie pas / requestPurchase échoue.
- Essai gratuit 7 jours : créer un "Introductory Offer" gratuit d'1 semaine sur CHAQUE abonnement (mensuel + annuel). L'app affiche alors automatiquement le badge/essai.

## Iteration 2026-07-16 (b) — Fix déblocage Premium post-achat + audit anti-régression
- BUG utilisateur : après achat StoreKit, Premium ne se débloquait pas (backend /iap/verify non déployé → is_premium restait false au reload). FIX : `applyLocalPremium()` dans AuthContext fusionne l'entitlement StoreKit de l'appareil (hasActive() iOS) dans user.is_premium à l'init/refresh/persist → Premium déverrouillé depuis l'abonnement de l'appareil, sans backend. Coach : `isPremiumEffective = serverPremium || user.is_premium`.
- AUDIT testing_agent iteration_8 : ZÉRO occurrence "Coach IA"/"Analyse IA" ; 4 onglets OK ; Aquacoach/Aquanalyse/Points d'eau tous présents. La plainte "anciens affichages" = build installé OBSOLÈTE (le code/preview a tout). → l'utilisateur doit régénérer/réinstaller le build iOS.
- Non testable sur web : hasActive()=false (iOS natif requis).

## Iteration 2026-07-26 — Aquanalyse intelligent (Apple Santé + score /100) & fix définitif Points d'eau
### Points d'eau (fix définitif)
- CAUSE RACINE : overpass-api.de renvoyait HTTP 406 sans en-tête User-Agent → l'app affichait "Aucun point d'eau". `src/api/waterpoints.ts` réécrit : en-tête User-Agent obligatoire, requêtes `nwr` (node/way/relation) `out center`, tags étendus (amenity=drinking_water/water_point, drinking_water=yes, man_made=water_tap, fountain=drinking, natural=spring+drinking_water), rayons progressifs 10/25/50 km, 3 miroirs Overpass, logs détaillés, distinction erreur réseau vs vide réel. Validé curl : 80 résultats à Paris.
- water-points.tsx : état d'erreur distinct ("fetchError" + bouton Réessayer), top 3 + distance + temps à pied + itinéraire (https maps.apple/google), modal détail (nom/adresse/distance) au tap. Fix http→https.
### Aquanalyse (IA + Apple Santé)
- healthkit.native.ts : `getHealthSnapshot()` lit pas, distance, énergie active/totale, FC, FC repos, HRV, respiration, SpO2, étages, stand, poids, IMC, sommeil (catégorie), séances (nb/durée/type). Tous optionnels/guardés iOS.
- backend `/api/insights` : score déterministe /100 (hydratation ajustée activité+météo, régularité, sommeil, FC, chaleur) + `score_reasons` ; IA (gpt-4o-mini) génère résumé + 3 conseils {text,reason} + prédiction. ROBUSTESSE : `_extract_json` (fences + bloc {} équilibré), retry x1, **fallback déterministe FR/EN/ES** garantissant conseils jamais vides. Testé 8/8 pytest + self-test UI OK.
- progress.tsx : badge score /100 (couleur selon niveau), raisons, résumé, conseils avec explication, prédiction (Premium), retry sur échec. insights.ts + payload enrichi (consumed_today, logs_today, last_intake_hours, hour_of_day, health snapshot).
- À DÉPLOYER par l'utilisateur sur drip-track1 (prod) : `/api/insights` enrichi (réf. server.py + DEPLOY_TO_REMOTE.md §3). Métriques Santé = build iOS natif uniquement.

## Iteration 2026-07-26 (b) — Bannière pub sur l'accueil + page téléchargement
- AdBanner ajouté sur l'écran d'accueil (index.tsx) pour utilisateurs gratuits (n'existait que sur Progrès/Profil → "pas de pub au lancement"). Vérifié testing_agent iteration_10 : aucune régression, 4 onglets + features Premium tous présents (réfutation "features supprimées").
- RAPPEL pub : AdMob ne s'affiche QUE sur build natif (jamais web/Expo Go). En dev build = TEST ads ; en prod = vraies pubs (fill possible après délai).
- À VÉRIFIER par l'utilisateur : dans app.json, `ios.iosAppId` == `androidAppId` (`ca-app-pub-8009813538542789~7753483038`) — les App IDs AdMob sont propres à chaque plateforme. Fournir le vrai App ID iOS + l'unité bannière iOS depuis la console AdMob (cause probable d'absence de pub iOS).
- Page téléchargement publique : aquadify-landing/telecharger.html (autonome, device-detect, vars APP_STORE_URL/GOOGLE_PLAY_URL vides, redirection auto si lien présent, boutons désactivés sinon). À héberger sur aquadify.com/telecharger (README fourni).

## Iteration 2026-07-26 (c) — Config AdMob finale (IDs réels par plateforme)
- app.json : iosAppId=ca-app-pub-8009813538542789~7753483038, androidAppId=...~2818700603 (étaient identiques → corrigé).
- AdBanner.native.tsx : unités bannière par plateforme (iOS .../9752960414, Android .../6405637532), TEST ads en __DEV__, exclu Premium, logs onAdLoaded/onAdFailedToLoad + init success/fail. Bannière sur accueil (free only).
- Vérifié testing_agent iteration_11 : aucune régression, Aquacoach/Aquanalyse/Points d'eau/Santé/Premium tous présents. Pub = build natif uniquement.

## Iteration 2026-07-27 — Se connecter avec Apple (bloquant App Store 4.8)
- expo-apple-authentication@8.0.8 installé. Bouton natif Apple (AppleAuthenticationButton, iOS only) ajouté sur auth.tsx sous le bouton Google, affiché uniquement si isAppleAvailable() (gated). Web/Android : aucun bouton (dégradation propre, jamais de crash — vérifié preview).
- src/lib/apple.native.ts (isAppleAvailable/signInWithApple/isAppleCancel) + apple.web.ts no-op (module natif JAMAIS dans le bundle web). src/components/AppleSignInButton.native|web.tsx.
- AuthContext.appleLogin() : signInWithApple() -> POST /auth/apple {identity_token,name,email} -> persist({token,user}) (même contrat que google/session). Annulation gérée sans toast.
- app.json : ios.usesAppleSignIn=true, ios.config.usesNonExemptEncryption=false, plugin "expo-apple-authentication".
- i18n auth.apple (fr/en/es).
- BACKEND À DÉPLOYER (DEPLOY_TO_REMOTE.md §5) : POST /api/auth/apple — vérif JWT Apple (JWKS RS256 + issuer + audience), upsert par apple_sub, renvoie {token,user}. Prérequis: pip pyjwt[crypto], env APPLE_AUDIENCES="com.mtagency.aquadify,host.exp.Exponent".
- Testable uniquement sur build iOS natif (ou Expo Go iOS avec audience host.exp.Exponent) + après déploiement de l'endpoint.

## Iteration 2026-08-08 — Corrections retour Apple App Review (2.1b, 5.1.1 ii/iv, 2.5.1)
- (2.5.1 localisation) app.json : NSLocationWhenInUseUsageDescription + plugin expo-location locationWhenInUsePermission réécrits (texte explicite FR : afficher points d'eau proches, distance, itinéraire). Seule la permission WhenInUse est demandée (pas de background).
- (5.1.1 pré-permission) water-points.tsx : bouton de l'écran explicatif « Autoriser » → « Continuer » (t common.continue). Il déclenche uniquement la demande système iOS ; message de refus neutre (non culpabilisant) conservé.
- (2.5.1 HealthKit identifiable) health.tsx : section clairement intitulée « Apple Santé » (icône cœur rouge) + explication (health.appleExplain) + bouton « Connecter Apple Santé » ; état connecté = « Apple Santé connecté » (health.appleConnected). iOS→Apple Santé, Android→Google Fit. Intégration HealthKit existante inchangée. i18n fr/en/es.
- (2.1b IAP) VÉRIFIÉ sans changement code : SKUs com.mtagency.aquadify.premium.monthly|yearly (iap.native.ts) alignés au bundleIdentifier com.mtagency.aquadify ; achat/restauration StoreKit OK ; is_premium activé post-achat (verify remote ou optimiste + entitlement local) ; AUCUNE référence Stripe sur iOS (fallback Stripe uniquement si !IAP_ENABLED = web/Android). Soumission produit + capture App Review = à faire manuellement dans App Store Connect (étapes fournies à l'utilisateur).

## Iteration 2026-08-09 — P2 App Store, Points d'eau gratuits, Apple Santé (Profil), Essai 7j mis en avant
- (P2 privacy manifest) app.json ios.privacyManifests : NSPrivacyAccessedAPITypes (UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1) pour AsyncStorage/AdMob.
- (P2 support) privacy.tsx : bouton « Contacter le support » (mailto:support@aquadify.com). i18n privacy.contactSupport fr/en/es.
- (Points d'eau GRATUITS) water-points.tsx : gate Premium SUPPRIMÉE → accessible gratuits + Premium. Retiré useAuth/premium + branche wp-locked. profile.tsx : cadenas retiré du lien Points d'eau. (Les clés i18n waterPoints.lockedTitle/Body/unlock restent, inutilisées.)
- (Apple Santé identifiable — Profil) profile.tsx : lien Santé affiche « Apple Santé » sur iOS (health.appleSection), « Santé & activité » ailleurs. Health reste Premium (cadenas conservé).
- (Essai 7j) premium.tsx : bannière verte « Essayez Premium gratuitement pendant 7 jours… » (premium.trialHero) affichée quand un produit a hasFreeTrial. Le mécanisme essai→payant = Introductory Offer StoreKit (auto-détecté). i18n fr/en/es.
- RAPPEL utilisateur : l'essai gratuit 7 jours DOIT être créé comme "Introductory Offer (Free, 1 week)" sur CHAQUE abonnement dans App Store Connect ; l'app l'affiche alors automatiquement.

## Iteration 2026-08-11 — Écran Premium : maquette abonnements toujours visible (captures stores)
- premium.tsx : quand StoreKit indisponible (web/Android/Expo Go) ou 0 produit, on n'affiche plus « Les achats sont disponibles sur l'app installée ». À la place, FALLBACK_PLANS statiques : Mensuel $3.99 / mois + Annuel $49.99 / an, badge « 7 jours offerts » sur les deux, « Meilleure offre » sur l'annuel, bannière essai + trialNote + cancelNote. But : permettre à l'utilisateur de faire les captures d'écran d'abonnement pour App Store Connect / Google Play.
- Rendu unifié : displayPlans = (IAP_ENABLED && products>0) ? products : FALLBACK_PLANS. onSelectPlan : produit StoreKit réel -> buy() ; sinon (web/Android) -> subscribeStripe(). Sur iOS natif, prix StoreKit LIVE remplacent $3.99/$49.99.
- Bouton Stripe unique supprimé (remplacé par les cartes de formule qui déclenchent Stripe hors iOS). Restore/Manage restent iOS-only. Clés premium.iapUnavailable + styles cta/ctaText désormais inutilisés.

## Iteration 2026-08-11 (b) — Bannière pub sur Points d'eau
- water-points.tsx : AdBanner ajouté en bas de l'écran (dans un View avec paddingBottom insets.bottom), au-dessus des modals. AdBanner gère déjà : null si Premium / Expo Go / web. S'affiche uniquement build natif pour utilisateurs gratuits. Cohérent avec Accueil/Progrès/Profil.

## Iteration 2026-08-18 — FIX critique : iOS n'ouvre plus JAMAIS Stripe (StoreKit only)
- RÉGRESSION introduite le 08-11 : FALLBACK_PLANS avec onSelectPlan -> subscribeStripe() quand produit sans .raw. Sur iOS (Expo Go OU build sans produits chargés), le tap ouvrait checkout.stripe.com (violation Apple 3.1.1) + mensuel/annuel = même lien Stripe premium.
- FIX premium.tsx : onSelectPlan -> Platform.OS==='ios' ? buy(p.id) : subscribeStripe(). iOS force StoreKit avec SKU distinct (monthly/yearly). buy() : si !IAP_ENABLED (Expo Go/web) -> toast premium.iapNeedsBuild (StoreKit indisponible hors build natif) au lieu de retomber sur Stripe.
- FALLBACK prices -> 4,99 € / 49,99 € (affichage web/Expo Go seulement ; en build natif = prix live StoreKit App Store Connect, 175 pays gérés côté Apple).
- i18n premium.iapNeedsBuild fr/en/es.
- CAUSE du bug utilisateur : test en Expo Go = StoreKit impossible. Doit builder (TestFlight) + tester avec compte Sandbox ; abonnements App Store Connect "Ready to Submit", même groupe, 175 pays + prix configurés.

## Backlog / Next
- P1: Apple Health / Google Fit connect (backend /health/* exists, mocked).
- P1: Edit profile (recompute goal) screen from Profil.
- P2: Streaming coach replies (/coach/chat/stream SSE).
- P2: Push notifications (remote) — only on user request + native build.
- P2: After production deploy, update EXPO_PUBLIC_AQUADIFY_API to the deployed backend URL.
