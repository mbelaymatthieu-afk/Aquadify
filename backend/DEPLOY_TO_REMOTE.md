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
