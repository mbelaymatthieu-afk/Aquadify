#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement: iOS-only update — replace Stripe with Apple StoreKit 2 (expo-iap), real Apple HealthKit for Premium, real account deletion (double confirmation), ATT prompt + global Error Boundary. Native features must be guarded so the web preview never crashes.

## frontend:
##   - task: "Account deletion double-confirmation flow (profile.tsx)"
##     implemented: true
##     working: "NA"
##     file: "app/(tabs)/profile.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Added Danger Zone -> Delete account button opening a Modal with step 1 (deleteTitle/deleteBody -> Continue) then step 2 (deleteFinalTitle -> Delete permanently). Calls DELETE /account on remote backend (endpoint NOT yet deployed -> will 404 and show deleteError toast). UI/modal flow is fully testable on web. testIDs: delete-account-button, delete-continue, delete-confirm, delete-cancel."
##   - task: "Premium screen StoreKit(iOS)/Stripe(web) split (premium.tsx)"
##     implemented: true
##     working: "NA"
##     file: "app/premium.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "On web (IAP_ENABLED=false) shows the existing Stripe CTA (testID premium-subscribe-button). StoreKit plan cards only render on iOS native build. Verify web still shows Stripe CTA and screen renders."
##   - task: "Health screen HealthKit(iOS)/mock(web) (health.tsx)"
##     implemented: true
##     working: "NA"
##     file: "app/health.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Free users see locked card + unlock CTA. Premium users on web see mocked connect flow (POST /health/connect). Real HealthKit only on iOS native. Verify locked state for free user."
##   - task: "Global Error Boundary + ATT prompt (_layout.tsx)"
##     implemented: true
##     working: "NA"
##     file: "app/_layout.tsx"
##     stuck_count: 0
##     priority: "medium"
##     needs_retesting: true
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "Wrapped app in ErrorBoundary; ATT requested before AdMob init (native no-op on web). Verify app boots normally."
##   - task: "Premium paywall: euro pricing + plan selection (premium.tsx)"
##     implemented: true
##     working: true
##     file: "app/premium.tsx"
##     stuck_count: 0
##     priority: "high"
##     needs_retesting: false
##     status_history:
##         -working: "NA"
##         -agent: "main"
##         -comment: "User reported: paywall showed prices in USD ($3.99/$49.99) and tapping a plan did not move the selection cursor. FIX: (1) displayEuroPrice() shows StoreKit displayPrice only if it already contains EUR, otherwise forces the exact euro amounts (Monthly 4,99 € / Yearly 59,99 €). (2) Added selectedId state (default yearly SKU) with a radio indicator + blue border on the selected card; tapping a plan now only SELECTS it (no longer buys immediately). (3) Added a primary CTA button (testID premium-subscribe) that triggers the purchase for the selected plan; CTA label is trial-aware (premium.ctaTrial for Monthly, premium.cta for Yearly). No change to StoreKit/SKU/iap.native.ts/Premium logic. TEST ON WEB (IAP disabled -> FALLBACK euro plans): open /premium, verify Monthly=4,99 €/mois & Yearly=59,99 €/an, default selection is Yearly, tapping Monthly moves the radio+highlight to Monthly and CTA becomes 'Commencer l'essai gratuit', tapping Yearly moves it back and CTA becomes 'Devenir Premium'. Do NOT attempt real payment/Stripe checkout completion."
##         -working: true
##         -agent: "testing"
##         -comment: "TESTED on web at /premium. ALL CRITICAL TESTS PASSED: (1) Currency - Monthly displays '4,99 €' with '/ mois', Yearly displays '59,99 €' with '/ an'. No user-visible dollar signs (only found in Cloudflare CDN security script which is not user-facing). (2) Default selection - Yearly is selected on load with filled radio button, blue border, and CTA button reads 'Devenir Premium'. (3) Plan selection follows tap - Clicking Monthly moves selection (filled radio + blue border to Monthly), CTA changes to 'Commencer l'essai gratuit'. Clicking Yearly moves selection back, CTA returns to 'Devenir Premium'. (4) Badges - Monthly shows '7 jours offerts', Yearly shows 'Meilleure offre' and does NOT show '7 jours offerts'. Screenshots confirm visual selection state changes correctly. Bug fix is successful and working as expected."

## metadata:
##   created_by: "main_agent"
##   version: "1.1"
##   test_sequence: 7

## test_plan:
##   current_focus:
##     - "Account deletion double-confirmation flow (profile.tsx)"
##     - "Premium screen StoreKit(iOS)/Stripe(web) split (premium.tsx)"
##     - "Health screen HealthKit(iOS)/mock(web) (health.tsx)"
##     - "Global Error Boundary + ATT prompt (_layout.tsx)"
##   stuck_tasks: []
##   test_all: false
##   test_priority: "high_first"

## agent_communication:
##     -agent: "main"
##     -message: "Iteration 6: iOS-native features (StoreKit via expo-iap, HealthKit) added behind Platform/appOwnership guards + platform-split lib files (iap.native/web, healthkit.native/web, tracking.native/web) so the web bundle never imports native modules. Please test FRONTEND ONLY on web: (1) login with mobiletest123@aqua.com / Test1234!, (2) Profile -> Danger Zone -> Delete account -> double confirmation modal (Continue then Delete permanently) — expect graceful error toast since remote DELETE /account is not deployed yet, (3) Premium screen renders with Stripe CTA on web, (4) Health screen shows locked card for free user. Do NOT attempt real payment. Native StoreKit/HealthKit cannot be tested on web (expected)."
##     -agent: "main"
##     -message: "Iteration 7 (bug fix): Premium paywall pricing/selection. Test FRONTEND ONLY on web at route /premium (no login required to render the paywall). Focus: (A) prices shown in EUROS — Monthly card = '4,99 €' with '/ mois', Yearly card = '59,99 €' with '/ an'; there must be NO '$' anywhere. (B) plan selection — on load the Yearly card is selected (filled radio-button-on + blue border, testID premium-plan-yearly) and the CTA button (testID premium-subscribe) reads 'Devenir Premium'; tapping the Monthly card (testID premium-plan-monthly) must move the selection to Monthly (its radio becomes filled, Yearly becomes unselected) and the CTA label must change to 'Commencer l'essai gratuit'; tapping Yearly again moves selection back and CTA returns to 'Devenir Premium'. (C) the Monthly card shows a '7 jours offerts' badge, the Yearly card does NOT. Do NOT complete any Stripe checkout (tapping the CTA on web opens a Stripe redirect — just verify the button exists/labels; no real payment)."
##     -agent: "testing"
##     -message: "Iteration 7 COMPLETE: Premium paywall bug fix verified and working correctly. All critical requirements passed: euro pricing (4,99 € / 59,99 €), no user-visible dollar signs, default Yearly selection, plan selection follows taps correctly with proper CTA label changes ('Devenir Premium' for Yearly, 'Commencer l'essai gratuit' for Monthly), and correct badges. The task is marked as working=true. Remaining tasks from Iteration 6 still need testing: Account deletion flow, Premium screen Stripe CTA, Health screen locked state, and Error Boundary."
