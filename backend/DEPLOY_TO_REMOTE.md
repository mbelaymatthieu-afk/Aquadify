# Endpoints à déployer sur le backend distant (drip-track1)

L'app mobile Aquadify appelle le backend de production
`https://drip-track-1.emergent.host/api`. Deux nouveaux endpoints doivent y être
ajoutés puis **redéployés** pour que la suppression de compte (App Store 5.1.1(v))
et les achats StoreKit fonctionnent.

> ⚠️ Le backend local `/app/backend/server.py` NE sert PAS l'authentification :
> c'est le backend drip-track1 (non modifiable depuis cet environnement) qui gère
> les utilisateurs. Copiez le code ci-dessous dans ce backend-là.

---

## 1) DELETE /api/account — Suppression de compte + données

Supprime définitivement le compte de l'utilisateur authentifié et toutes ses données.

```python
from fastapi import Depends, HTTPException

@api_router.delete("/account")
async def delete_account(current_user = Depends(get_current_user)):
    uid = current_user["id"]  # adaptez à votre modèle
    # Supprimer toutes les données liées à l'utilisateur
    await db.hydration_logs.delete_many({"user_id": uid})
    await db.coach_messages.delete_many({"user_id": uid})
    await db.sessions.delete_many({"user_id": uid})
    await db.payments.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"deleted": True}
```

- `get_current_user` : votre dépendance existante qui résout le Bearer token.
- Adaptez les noms de collections à votre schéma réel.

---

## 2) IAP StoreKit 2 — Premium lié au COMPTE (verify + restore + webhook)

Objectif : `is_premium` appartient au **compte Aquadify authentifié**, jamais à
l'appareil/Apple ID. Le backend vérifie réellement le **JWS signé** StoreKit 2,
lie l'abonnement à **un seul** compte (unicité `original_transaction_id`), et
**dérive** `is_premium` d'un abonnement actif non expiré (jamais permanent :
retiré si expiré / révoqué / remboursé / fin de période).

### Prérequis
- `pip install app-store-server-library pyjwt cryptography`
- Variables d'env sur drip-track1 :
  - `APPLE_BUNDLE_ID=com.mtagency.aquadify`
  - `APPLE_ENV=Production` (mettre `Sandbox` pour les tests TestFlight)
  - `APPLE_ROOT_CERTS=/chemin/AppleRootCA-G3.cer` (un ou plusieurs, séparés par `,`)

### Migration BDD (MongoDB) — collection dédiée `subscriptions`
```javascript
db.createCollection("subscriptions");

// UNICITÉ : un abonnement Apple (original_transaction_id) = UN SEUL compte.
db.subscriptions.createIndex(
  { original_transaction_id: 1 },
  { unique: true, name: "uniq_original_tx" }
);

db.subscriptions.createIndex({ user_id: 1 });
db.subscriptions.createIndex({ status: 1, expires_at: 1 });
```
Schéma d'un document `subscriptions` :
```
{ id, user_id, platform:"ios", product_id, original_transaction_id (UNIQUE),
  transaction_id, status:"active|expired|revoked|refunded",
  expires_at, last_verified_at, created_at, updated_at }
```
`users.is_premium` devient un champ **dérivé** (recalculé), plus une source autonome.

### Code partagé (helpers)
```python
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from appstoreserverlibrary.signed_data_verifier import SignedDataVerifier, VerificationException
from appstoreserverlibrary.models.Environment import Environment

VALID_PRODUCTS = {
    "com.mtagency.aquadify.premium.monthly",
    "com.mtagency.aquadify.premium.yearly",
}
BUNDLE_ID = os.environ["APPLE_BUNDLE_ID"]
APP_ENV = (Environment.PRODUCTION
           if os.environ.get("APPLE_ENV") == "Production"
           else Environment.SANDBOX)

# Apple Root CAs (DER). Requis pour valider la chaîne x5c du JWS signé.
_root_certs = [open(p, "rb").read()
               for p in os.environ.get("APPLE_ROOT_CERTS", "").split(",") if p]
_verifier = SignedDataVerifier(_root_certs, enable_online_checks=True,
                               environment=APP_ENV, bundle_id=BUNDLE_ID,
                               app_apple_id=None)

def _status_from_tx(tx) -> tuple[str, datetime | None]:
    """Statut dérivé du payload de transaction décodé + signé."""
    now = datetime.now(timezone.utc)
    expires = (datetime.fromtimestamp(tx.expiresDate / 1000, tz=timezone.utc)
               if tx.expiresDate else None)
    if getattr(tx, "revocationDate", None):     # remboursé / révoqué par Apple
        return "revoked", expires
    if expires and expires < now:
        return "expired", expires
    return "active", expires

async def _recompute_is_premium(uid: str) -> bool:
    """is_premium = au moins UN abonnement actif non expiré. Jamais permanent."""
    now = datetime.now(timezone.utc)
    active = await db.subscriptions.find_one({
        "user_id": uid, "status": "active",
        "$or": [{"expires_at": None}, {"expires_at": {"$gt": now}}],
    })
    is_premium = bool(active)
    await db.users.update_one({"id": uid}, {"$set": {"is_premium": is_premium}})
    return is_premium

async def _upsert_subscription(uid: str, tx) -> None:
    """Lie/actualise l'abonnement pour CE compte, avec protection d'unicité."""
    original = tx.originalTransactionId
    existing = await db.subscriptions.find_one({"original_transaction_id": original})
    if existing and existing["user_id"] != uid:
        # PROTECTION : abonnement déjà rattaché à un autre compte Aquadify.
        raise HTTPException(409, "Cet abonnement est déjà lié à un autre compte.")
    status, expires = _status_from_tx(tx)
    now = datetime.now(timezone.utc)
    await db.subscriptions.update_one(
        {"original_transaction_id": original},
        {"$set": {
            "user_id": uid, "platform": "ios", "product_id": tx.productId,
            "original_transaction_id": original, "transaction_id": tx.transactionId,
            "status": status, "expires_at": expires,
            "last_verified_at": now, "updated_at": now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await _recompute_is_premium(uid)

def _decode_tx(jws: str):
    """Vérifie la signature + chaîne Apple, puis rejette produit/bundle inconnus."""
    if not jws:
        raise HTTPException(400, "JWS manquant.")
    try:
        tx = _verifier.verify_and_decode_signed_transaction(jws)
    except VerificationException:
        raise HTTPException(401, "Transaction Apple invalide.")
    if tx.bundleId != BUNDLE_ID or tx.productId not in VALID_PRODUCTS:
        raise HTTPException(400, "Produit/bundle inconnu.")
    return tx
```

### 2a) POST /api/iap/verify — Validation d'un achat
Body : `{ "product_id": str?, "transaction_id": str?, "jws": str }`
```python
class IapVerifyRequest(BaseModel):
    product_id: str | None = None
    transaction_id: str | None = None
    jws: str | None = None

@api_router.post("/iap/verify")
async def iap_verify(req: IapVerifyRequest, current_user = Depends(get_current_user)):
    tx = _decode_tx(req.jws)
    await _upsert_subscription(current_user["id"], tx)   # lie + recalcule is_premium
    user = await db.users.find_one({"id": current_user["id"]})
    return serialize_user(user)                          # même format que /auth/me
```

### 2b) POST /api/iap/restore — Restauration sécurisée (endpoint dédié)
L'app envoie le/les JWS restauré(s). Le backend valide, récupère
`originalTransactionId`, vérifie l'appartenance et ne confirme Premium que si le
compte courant est bien le propriétaire. Sinon → **pas de Premium** (403/409).
Body : `{ "jws": str }` **ou** `{ "jws_list": [str, ...] }`
```python
class IapRestoreRequest(BaseModel):
    jws: str | None = None
    jws_list: list[str] | None = None

@api_router.post("/iap/restore")
async def iap_restore(req: IapRestoreRequest, current_user = Depends(get_current_user)):
    uid = current_user["id"]
    tokens = req.jws_list or ([req.jws] if req.jws else [])
    if not tokens:
        raise HTTPException(400, "Aucune transaction à restaurer.")

    restored_any = False
    for jws in tokens:
        tx = _decode_tx(jws)
        original = tx.originalTransactionId
        existing = await db.subscriptions.find_one({"original_transaction_id": original})
        if existing and existing["user_id"] != uid:
            # Abonnement d'un AUTRE compte : ne jamais partager Premium.
            continue
        await _upsert_subscription(uid, tx)
        restored_any = True

    is_premium = await _recompute_is_premium(uid)
    if not (restored_any and is_premium):
        # Échec sécurisé : rien restauré pour CE compte, ou abo inactif/expiré.
        raise HTTPException(404, "Aucun abonnement actif à restaurer pour ce compte.")
    user = await db.users.find_one({"id": uid})
    return serialize_user(user)
```

### 2c) POST /api/iap/apple-notifications — App Store Server Notifications V2
Indispensable pour **retirer** Premium à l'expiration / annulation / remboursement
/ révocation, **sans dépendre du client**. À déclarer dans App Store Connect.
```python
@api_router.post("/iap/apple-notifications")
async def apple_notifications(payload: dict):
    try:
        notif = _verifier.verify_and_decode_notification(payload["signedPayload"])
        tx = _verifier.verify_and_decode_signed_transaction(
            notif.data.signedTransactionInfo)
    except (VerificationException, KeyError, AttributeError):
        raise HTTPException(401, "Notification invalide.")
    sub = await db.subscriptions.find_one(
        {"original_transaction_id": tx.originalTransactionId})
    if sub:
        # EXPIRED / DID_FAIL_TO_RENEW / REFUND / REVOKE / DID_CHANGE_RENEWAL_STATUS…
        await _upsert_subscription(sub["user_id"], tx)   # recalcule status + is_premium
    return {"ok": True}
```

> ⚠️ `serialize_user` doit renvoyer `is_premium` tel que stocké (dérivé). Tant que
> ces endpoints ne sont pas déployés, l'app échoue **de façon sécurisée** (aucun
> Premium local accordé) et affiche un message clair.

---

Après ajout de ces endpoints, redéployez le backend drip-track1. L'app mobile
appelle déjà `DELETE /account` et `POST /iap/verify` ; en attendant le déploiement,
elle affiche un message d'erreur clair (endpoint introuvable).

---

## 3) POST /api/insights — Aquanalyse (IA + score /100)

L'app appelle cet endpoint pour Aquanalyse. En dev il est servi par le backend
local `/app/backend/server.py` (déjà à jour). Pour la PRODUCTION, copiez la
logique de `server.py` (classes `HealthSnapshot`, `InsightsRequest`, fonctions
`_activity_bonus_ml`, `compute_score`, et la route `POST /api/insights`) dans le
backend drip-track1, en réutilisant votre `EMERGENT_LLM_KEY`.

Body (extrait) :
```json
{
  "goal": 2500, "consumed_today": 1200, "logs_today": 4,
  "last_intake_hours": 1.5, "hour_of_day": 15,
  "average": 1900, "days_achieved": 4, "total_days": 7,
  "current_streak": 3, "best_streak": 9,
  "recent": [{"date":"2026-07-20","total":2100,"goal":2500}],
  "activity_trend": [],
  "health": {"steps":15300,"active_energy":620,"sleep_hours":5.5,"resting_heart_rate":58,"temperature_c":31},
  "language": "fr"
}
```
Réponse : `{ score, adjusted_goal, score_reasons, summary, tips:[{text,reason}], prediction }`.

Sans ce déploiement, Aquanalyse se dégrade proprement en prod (message d'erreur).

---

## 4) Authentification renforcée (vérification e-mail par code + reset) — à AJOUTER dans drip-track1

Prérequis :
- `pip install "passlib[bcrypt]" resend` (bcrypt pour le hash, Resend pour l'envoi d'e-mails).
- Variables d'env sur drip-track1 : `RESEND_API_KEY=...`, `RESEND_FROM="Aquadify <no-reply@aquadify.com>"` (domaine vérifié dans Resend).
- L'app mobile appelle déjà ces endpoints (contrat JSON `{token, user}`). Tant qu'ils ne sont pas déployés, l'inscription reste rétro-compatible (si `/auth/register` renvoie un token, l'app connecte directement).

```python
import os, re, random, hashlib
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Request
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import resend

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
resend.api_key = os.environ.get("RESEND_API_KEY")
FROM = os.environ.get("RESEND_FROM", "Aquadify <no-reply@aquadify.com>")

STRONG = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")
def _valid_pw(p): return bool(STRONG.match(p or ""))
def _code(): return f"{random.randint(0, 999999):06d}"
def _hash_code(c): return hashlib.sha256(c.encode()).hexdigest()

async def _send_email(to, subject, html):
    try:
        resend.Emails.send({"from": FROM, "to": [to], "subject": subject, "html": html})
    except Exception as e:
        print("[resend] send failed:", e)

class RegisterReq(BaseModel):
    name: str; email: EmailStr; password: str
class VerifyReq(BaseModel):
    email: EmailStr; code: str
class EmailReq(BaseModel):
    email: EmailStr
class ResetReq(BaseModel):
    email: EmailStr; code: str; password: str

# Simple in-memory rate limiter (use Redis/Mongo TTL in prod for multi-instance).
_attempts = {}
def _rate_limit(key, maxn=5, window=900):
    now = datetime.now(timezone.utc).timestamp()
    arr = [t for t in _attempts.get(key, []) if now - t < window]
    if len(arr) >= maxn:
        raise HTTPException(429, "Trop de tentatives, réessayez plus tard.")
    arr.append(now); _attempts[key] = arr

@api_router.post("/auth/register")
async def register(req: RegisterReq):
    if not _valid_pw(req.password):
        raise HTTPException(400, "Mot de passe trop faible.")
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing and existing.get("email_verified"):
        raise HTTPException(409, "Adresse e-mail déjà utilisée.")
    code = _code()
    doc = {
        "name": req.name, "email": req.email.lower(),
        "password": pwd.hash(req.password),
        "email_verified": False,
        "verify_code": _hash_code(code),
        "verify_expires": datetime.now(timezone.utc) + timedelta(minutes=15),
        "verify_attempts": 0,
        # ... vos champs par défaut (daily_goal_ml, is_premium=False, profile, etc.)
    }
    if existing:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": doc})
    else:
        await db.users.insert_one(doc)
    await _send_email(req.email, "Votre code Aquadify",
                      f"<p>Votre code de vérification : <b>{code}</b> (valable 15 min).</p>")
    return {"requires_verification": True, "email": req.email.lower()}

@api_router.post("/auth/verify-email")
async def verify_email(req: VerifyReq):
    u = await db.users.find_one({"email": req.email.lower()})
    if not u or not u.get("verify_code"):
        raise HTTPException(400, "Code invalide.")
    if u.get("verify_attempts", 0) >= 5:
        raise HTTPException(429, "Trop d'essais. Renvoyez un code.")
    if datetime.now(timezone.utc) > u["verify_expires"].replace(tzinfo=timezone.utc):
        raise HTTPException(400, "Code expiré.")
    if _hash_code(req.code) != u["verify_code"]:
        await db.users.update_one({"_id": u["_id"]}, {"$inc": {"verify_attempts": 1}})
        raise HTTPException(400, "Code invalide.")
    await db.users.update_one({"_id": u["_id"]},
        {"$set": {"email_verified": True},
         "$unset": {"verify_code": "", "verify_expires": "", "verify_attempts": ""}})
    u = await db.users.find_one({"_id": u["_id"]})
    return {"token": create_token(u), "user": serialize_user(u)}  # auto-login

@api_router.post("/auth/resend-verification")
async def resend_verification(req: EmailReq, request: Request):
    _rate_limit(f"resend:{req.email.lower()}", maxn=3, window=900)
    u = await db.users.find_one({"email": req.email.lower()})
    if u and not u.get("email_verified"):
        code = _code()
        await db.users.update_one({"_id": u["_id"]}, {"$set": {
            "verify_code": _hash_code(code),
            "verify_expires": datetime.now(timezone.utc) + timedelta(minutes=15),
            "verify_attempts": 0}})
        await _send_email(req.email, "Votre code Aquadify",
                          f"<p>Votre nouveau code : <b>{code}</b> (valable 15 min).</p>")
    return {"ok": True}

@api_router.post("/auth/login")
async def login(req: EmailReq2):  # {email, password}
    _rate_limit(f"login:{req.email.lower()}", maxn=8, window=900)
    u = await db.users.find_one({"email": req.email.lower()})
    if not u or not pwd.verify(req.password, u.get("password", "")):
        raise HTTPException(401, "E-mail ou mot de passe incorrect.")
    if not u.get("email_verified"):
        raise HTTPException(403, detail={"message": "E-mail non vérifié.", "requires_verification": True})
    return {"token": create_token(u), "user": serialize_user(u)}

@api_router.post("/auth/forgot-password")
async def forgot_password(req: EmailReq):
    _rate_limit(f"forgot:{req.email.lower()}", maxn=3, window=900)
    u = await db.users.find_one({"email": req.email.lower()})
    if u:  # ne pas révéler si l'e-mail existe
        code = _code()
        await db.users.update_one({"_id": u["_id"]}, {"$set": {
            "reset_code": _hash_code(code),
            "reset_expires": datetime.now(timezone.utc) + timedelta(minutes=15)}})
        await _send_email(req.email, "Réinitialisation Aquadify",
                          f"<p>Votre code de réinitialisation : <b>{code}</b> (valable 15 min).</p>")
    return {"ok": True}

@api_router.post("/auth/reset-password")
async def reset_password(req: ResetReq):
    if not _valid_pw(req.password):
        raise HTTPException(400, "Mot de passe trop faible.")
    u = await db.users.find_one({"email": req.email.lower()})
    if not u or not u.get("reset_code"):
        raise HTTPException(400, "Code invalide.")
    if datetime.now(timezone.utc) > u["reset_expires"].replace(tzinfo=timezone.utc):
        raise HTTPException(400, "Code expiré.")
    if _hash_code(req.code) != u["reset_code"]:
        raise HTTPException(400, "Code invalide.")
    await db.users.update_one({"_id": u["_id"]},
        {"$set": {"password": pwd.hash(req.password)},
         "$unset": {"reset_code": "", "reset_expires": ""}})
    return {"ok": True}
```

Notes :
- `create_token` / `serialize_user` : réutilisez vos fonctions existantes (JWT + format identique à `/auth/me`).
- `EmailReq2` = votre modèle login existant `{email, password}`.
- Indispensable : hachage **bcrypt** (jamais en clair), codes **hachés + TTL 15 min**, **rate limiting** login/resend/forgot, login **bloqué** tant que `email_verified` est faux. La vérification n'est demandée qu'à l'inscription ; ensuite l'utilisateur se connecte normalement.
- Adaptez les noms de collections/champs à votre schéma réel.

---

## 5) POST /api/auth/apple — Se connecter avec Apple (bloquant App Store 4.8)

L'app iOS envoie l'`identity_token` Apple (JWT). Le backend le **vérifie** contre
les clés publiques Apple (JWKS RS256), puis crée/retrouve l'utilisateur par le
claim `sub` (identifiant Apple stable) et renvoie `{token, user}` — **même format
que `/auth/login` et `/auth/google/session`**.

Prérequis :
- `pip install "pyjwt[crypto]"`
- Variable d'env sur drip-track1 : `APPLE_AUDIENCES="com.mtagency.aquadify,host.exp.Exponent"`
  (le bundle id de production **ET** `host.exp.Exponent` pour Expo Go durant les tests).

> ⚠️ Le nom et l'e-mail ne sont fournis par Apple **qu'à la 1re connexion** →
> à sauvegarder immédiatement, ne jamais écraser avec des valeurs nulles ensuite.
> Avec « Masquer mon e-mail », l'e-mail est une adresse relais `@privaterelay.appleid.com`
> → **toujours** identifier l'utilisateur par `apple_sub`, pas par l'e-mail.

```python
import os, jwt
from jwt import PyJWKClient
from fastapi import HTTPException
from pydantic import BaseModel

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_AUDIENCES = [a.strip() for a in os.environ.get("APPLE_AUDIENCES", "").split(",") if a.strip()]
_apple_jwks = PyJWKClient("https://appleid.apple.com/auth/keys")

class AppleReq(BaseModel):
    identity_token: str
    name: str | None = None
    email: str | None = None

@api_router.post("/auth/apple")
async def auth_apple(req: AppleReq):
    # 1) Vérifier le JWT Apple (signature RS256 + issuer + audience + expiration).
    try:
        signing_key = _apple_jwks.get_signing_key_from_jwt(req.identity_token).key
        claims = jwt.decode(
            req.identity_token,
            signing_key,
            algorithms=["RS256"],
            audience=APPLE_AUDIENCES,   # accepte n'importe quelle audience de la liste
            issuer=APPLE_ISSUER,
        )
    except Exception:
        raise HTTPException(401, "Jeton Apple invalide.")

    apple_sub = claims.get("sub")
    if not apple_sub:
        raise HTTPException(401, "Jeton Apple invalide.")
    token_email = claims.get("email")  # présent surtout à la 1re connexion

    # 2) Upsert par apple_sub (source de vérité), jamais par e-mail.
    u = await db.users.find_one({"apple_sub": apple_sub})
    if not u:
        u = {
            # ... vos champs par défaut (daily_goal_ml, is_premium=False, profile, etc.)
            "apple_sub": apple_sub,
            "email": (req.email or token_email or f"{apple_sub}@privaterelay.appleid.com").lower(),
            "name": req.name or "Utilisateur Apple",
            "email_verified": True,          # Apple garantit l'e-mail
            "auth_provider": "apple",
        }
        await db.users.insert_one(u)
        u = await db.users.find_one({"apple_sub": apple_sub})
    else:
        # Compléter nom/e-mail uniquement s'ils manquent (fournis 1x par Apple).
        patch = {}
        if req.name and not u.get("name"):
            patch["name"] = req.name
        if (req.email or token_email) and not u.get("email"):
            patch["email"] = (req.email or token_email).lower()
        if patch:
            await db.users.update_one({"apple_sub": apple_sub}, {"$set": patch})
            u = await db.users.find_one({"apple_sub": apple_sub})

    return {"token": create_token(u), "user": serialize_user(u)}
```

Notes :
- `create_token` / `serialize_user` : réutilisez vos fonctions existantes.
- Index MongoDB recommandé : unique sparse sur `apple_sub`.
- Tant que cet endpoint n'est pas déployé, le bouton Apple affiche un message
  d'erreur clair côté app (pas de crash), mais **Apple exige ce bouton pour
  l'App Store** dès lors que Google est proposé (règle 4.8).

