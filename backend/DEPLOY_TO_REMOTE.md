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

## 2) POST /api/iap/verify — Vérification d'achat Apple StoreKit 2

Vérifie une transaction StoreKit et active `is_premium`.

Body: `{ "product_id": str, "transaction_id": str, "jws": str }`

```python
from pydantic import BaseModel

class IapVerifyRequest(BaseModel):
    product_id: str
    transaction_id: str | None = None
    jws: str | None = None

@api_router.post("/iap/verify")
async def iap_verify(req: IapVerifyRequest, current_user = Depends(get_current_user)):
    # TODO (recommandé en prod): vérifier le JWS signé auprès de l'App Store
    # Server API (https://developer.apple.com/documentation/appstoreserverapi).
    # Pour un MVP, on fait confiance au client puis on dédoublonne par transaction_id.
    valid_products = [
        "com.mtagency.aquadify.premium.monthly",
        "com.mtagency.aquadify.premium.yearly",
    ]
    if req.product_id not in valid_products:
        raise HTTPException(status_code=400, detail="Produit inconnu")

    uid = current_user["id"]
    await db.users.update_one(
        {"id": uid},
        {"$set": {
            "is_premium": True,
            "premium_product_id": req.product_id,
            "premium_transaction_id": req.transaction_id,
        }},
    )
    user = await db.users.find_one({"id": uid})
    # Retournez l'utilisateur au même format que /auth/me
    return serialize_user(user)
```

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
