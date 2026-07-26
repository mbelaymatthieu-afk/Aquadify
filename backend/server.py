from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


# --- Premium AI hydration insights (uses Emergent LLM key) ---
class HealthSnapshot(BaseModel):
    steps: Optional[float] = None
    distance_km: Optional[float] = None
    active_energy: Optional[float] = None      # kcal
    total_energy: Optional[float] = None       # kcal
    heart_rate: Optional[float] = None         # avg bpm today
    resting_heart_rate: Optional[float] = None # bpm
    workouts: Optional[int] = None             # count today
    workout_minutes: Optional[float] = None
    workout_types: List[str] = []
    stand_minutes: Optional[float] = None
    flights_climbed: Optional[float] = None
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    sleep_hours: Optional[float] = None
    hrv: Optional[float] = None                # ms
    respiratory_rate: Optional[float] = None   # breaths/min
    spo2: Optional[float] = None               # 0-1 or %
    temperature_c: Optional[float] = None      # outdoor temp if available


class InsightsRequest(BaseModel):
    goal: int = 2000
    consumed_today: float = 0
    logs_today: int = 0
    last_intake_hours: Optional[float] = None
    hour_of_day: int = 12
    average: float = 0
    days_achieved: int = 0
    total_days: int = 7
    current_streak: int = 0
    best_streak: int = 0
    recent: List[dict] = []
    activity_trend: List[dict] = []
    health: Optional[HealthSnapshot] = None
    language: str = "fr"


def _activity_bonus_ml(h: Optional[HealthSnapshot]) -> int:
    bonus = 0
    if h:
        steps = h.steps or 0
        if steps > 5000:
            bonus += int((steps - 5000) // 1000) * 100
        active = h.active_energy or 0
        bonus += int(active // 100) * 50
        wmin = h.workout_minutes or 0
        bonus += int(wmin // 30) * 150
        if h.temperature_c is not None and h.temperature_c >= 28:
            bonus += 300
    return min(bonus, 1500)


def compute_score(req: InsightsRequest):
    """Deterministic hydration score /100 with explainable contributors."""
    h = req.health
    goal = max(1, req.goal)
    adj_goal = goal + _activity_bonus_ml(h)
    reasons = []
    comps = []  # (value 0-1, weight)

    # 1) Activity-adjusted hydration adequacy (main driver)
    adequacy = min(1.0, (req.consumed_today or 0) / adj_goal) if adj_goal else 0.0
    comps.append((adequacy, 45))
    reasons.append(f"hydratation {int(req.consumed_today or 0)}/{adj_goal} ml")

    # 2) Regularity vs elapsed part of the day (08h -> 22h window)
    frac_day = min(1.0, max(0.0, (req.hour_of_day - 8) / 14))
    expected = max(1, round(frac_day * 6))
    reg = min(1.0, (req.logs_today or 0) / expected)
    comps.append((reg, 20))
    reasons.append(f"régularité {req.logs_today} prise(s)")

    # 3) Sleep
    if h and h.sleep_hours is not None:
        s = h.sleep_hours
        sleep_score = 1.0 if 7 <= s <= 9 else (0.7 if (6 <= s < 7 or 9 < s <= 10) else 0.4)
        comps.append((sleep_score, 12))
        reasons.append(f"sommeil {round(s,1)} h")

    # 4) Resting heart rate
    if h and h.resting_heart_rate:
        rhr = h.resting_heart_rate
        hr_score = 1.0 if rhr <= 70 else (0.75 if rhr <= 85 else 0.5)
        comps.append((hr_score, 8))
        reasons.append(f"FC repos {int(rhr)} bpm")

    # 5) Heat awareness (hot days require proportionally more)
    if h and h.temperature_c is not None:
        heat = 1.0 if h.temperature_c < 28 else adequacy
        comps.append((heat, 8))
        reasons.append(f"météo {round(h.temperature_c)}°C")

    total_w = sum(w for _, w in comps)
    score = round(sum(v * w for v, w in comps) / total_w * 100) if total_w else round(adequacy * 100)
    score = max(0, min(100, score))
    return score, adj_goal, reasons


def _extract_json(raw: str):
    """Best-effort parse of an LLM response into a dict."""
    import json as _json
    if not raw:
        return None
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.lower().startswith("json"):
            s = s[4:]
    # Try direct, then the first balanced {...} block.
    for candidate in (s, s[s.find("{"): s.rfind("}") + 1] if "{" in s and "}" in s else ""):
        if not candidate:
            continue
        try:
            return _json.loads(candidate)
        except Exception:
            continue
    return None


def _fallback_insights(req: "InsightsRequest", score: int, adj_goal: int):
    """Deterministic, contextual insights when the LLM output is unusable.
    Guarantees a non-empty, personalized result built from the real numbers."""
    lang = req.language if req.language in ("fr", "en", "es") else "fr"
    h = req.health
    consumed = int(req.consumed_today or 0)
    remaining = max(0, adj_goal - consumed)
    steps = int((h.steps if h else 0) or 0)
    temp = (h.temperature_c if h else None)
    sleep = (h.sleep_hours if h else None)

    T = {
        "fr": {
            "summary": f"Score d'hydratation {score}/100 — il vous reste {remaining} ml pour atteindre votre objectif du jour.",
            "remaining": (f"Buvez encore {remaining} ml d'ici ce soir.", f"Vous êtes à {consumed} ml sur un objectif ajusté de {adj_goal} ml."),
            "steps": (f"Ajoutez un grand verre après votre activité.", f"Vos {steps} pas aujourd'hui ont augmenté vos pertes en eau."),
            "heat": ("Gardez de l'eau à portée de main.", f"Il fait {round(temp) if temp else ''}°C : la chaleur accélère la déshydratation."),
            "sleep": ("Commencez la matinée par un grand verre d'eau.", f"Nuit courte ({round(sleep,1) if sleep else ''} h) : l'hydratation aide à réduire la fatigue."),
            "regular": ("Espacez vos prises d'eau toutes les heures.", "Une hydratation régulière vaut mieux qu'une grande quantité d'un coup."),
            "reach_no": f"À ce rythme, l'objectif de {adj_goal} ml risque de ne pas être atteint : buvez un verre maintenant.",
            "reach_yes": "Vous êtes en bonne voie pour atteindre votre objectif, continuez ainsi !",
        },
        "en": {
            "summary": f"Hydration score {score}/100 — {remaining} ml left to reach today's goal.",
            "remaining": (f"Drink {remaining} ml more before tonight.", f"You're at {consumed} ml of an adjusted {adj_goal} ml goal."),
            "steps": ("Add a large glass after your activity.", f"Your {steps} steps today increased water loss."),
            "heat": ("Keep water within reach.", f"It's {round(temp) if temp else ''}°C: heat speeds up dehydration."),
            "sleep": ("Start the morning with a big glass of water.", f"Short night ({round(sleep,1) if sleep else ''} h): hydration helps reduce fatigue."),
            "regular": ("Space your intake every hour.", "Regular sips beat one big gulp."),
            "reach_no": f"At this pace you may miss the {adj_goal} ml goal: drink a glass now.",
            "reach_yes": "You're on track to reach your goal, keep it up!",
        },
        "es": {
            "summary": f"Puntuación de hidratación {score}/100 — te faltan {remaining} ml para tu objetivo de hoy.",
            "remaining": (f"Bebe {remaining} ml más antes de la noche.", f"Vas por {consumed} ml de un objetivo ajustado de {adj_goal} ml."),
            "steps": ("Añade un vaso grande tras tu actividad.", f"Tus {steps} pasos de hoy aumentaron la pérdida de agua."),
            "heat": ("Ten agua a mano.", f"Hace {round(temp) if temp else ''}°C: el calor acelera la deshidratación."),
            "sleep": ("Empieza la mañana con un buen vaso de agua.", f"Noche corta ({round(sleep,1) if sleep else ''} h): la hidratación ayuda a reducir la fatiga."),
            "regular": ("Reparte la ingesta cada hora.", "Beber a sorbos regulares es mejor que de golpe."),
            "reach_no": f"A este ritmo podrías no alcanzar los {adj_goal} ml: bebe un vaso ahora.",
            "reach_yes": "Vas por buen camino para alcanzar tu objetivo, ¡sigue así!",
        },
    }[lang]

    tips = []
    if remaining > 0:
        tips.append({"text": T["remaining"][0], "reason": T["remaining"][1]})
    if steps > 8000:
        tips.append({"text": T["steps"][0], "reason": T["steps"][1]})
    if temp is not None and temp >= 28:
        tips.append({"text": T["heat"][0], "reason": T["heat"][1]})
    if sleep is not None and sleep < 6:
        tips.append({"text": T["sleep"][0], "reason": T["sleep"][1]})
    if (req.logs_today or 0) < 3:
        tips.append({"text": T["regular"][0], "reason": T["regular"][1]})
    if not tips:
        tips.append({"text": T["regular"][0], "reason": T["regular"][1]})

    frac_day = min(1.0, max(0.0, (req.hour_of_day - 8) / 14))
    on_track = adj_goal <= 0 or (consumed / adj_goal) >= max(0.15, frac_day * 0.9)
    prediction = T["reach_yes"] if on_track else T["reach_no"]
    return {"summary": T["summary"], "tips": tips[:3], "prediction": prediction}


@api_router.post("/insights")
async def hydration_insights(req: InsightsRequest):
    import json as _json
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    score, adj_goal, reasons = compute_score(req)
    key = os.environ.get("EMERGENT_LLM_KEY")
    lang_name = {"fr": "French", "en": "English", "es": "Spanish"}.get(req.language, "French")

    system = (
        "You are Aquadify, a premium hydration & wellness coach. You connect Apple Health data, "
        "physical activity, weather, sleep and hydration habits to produce SPECIFIC, personalized, "
        "NON-medical guidance. Never give generic advice like 'drink a glass at wake up' or 'carry a bottle'. "
        "Every tip MUST reference the user's actual numbers and explain WHY. Vary wording so it feels fresh each day. "
        f"Always answer in {lang_name}. "
        "Return ONLY valid minified JSON (double-quoted keys/strings, no trailing commas, no newlines inside strings) "
        "with EXACTLY this shape: "
        '{"summary":"one motivating sentence <=160 chars that mentions the score",'
        '"tips":[{"text":"specific actionable tip <=120 chars","reason":"short why <=120 chars, cite a metric"}],'
        '"prediction":"1 sentence: will they reach the goal by end of day given pace/time/activity, + one concrete action"}. '
        "Provide 3 tips. No markdown, no extra keys, no text outside JSON."
    )

    h = req.health.dict() if req.health else {}
    context = {
        "hydration_score": score,
        "score_contributors": reasons,
        "daily_goal_ml": req.goal,
        "activity_adjusted_goal_ml": adj_goal,
        "consumed_today_ml": req.consumed_today,
        "intake_events_today": req.logs_today,
        "hours_since_last_drink": req.last_intake_hours,
        "current_hour": req.hour_of_day,
        "7d_average_ml": round(req.average),
        "days_goal_reached": f"{req.days_achieved}/{req.total_days}",
        "current_streak_days": req.current_streak,
        "best_streak_days": req.best_streak,
        "recent_daily_totals": req.recent,
        "activity_trend": req.activity_trend,
        "apple_health_today": {k: v for k, v in h.items() if v not in (None, [], 0)},
    }
    user_msg = "User context (JSON):\n" + _json.dumps(context, ensure_ascii=False)

    data = None
    for _ in range(2):  # one retry on unparseable output
        try:
            chat = LlmChat(api_key=key, session_id=f"insights-{uuid.uuid4().hex[:8]}", system_message=system)
            chat.with_model("openai", "gpt-4o-mini")
            text = await chat.send_message(UserMessage(text=user_msg))
            data = _extract_json(text or "")
            if data and isinstance(data.get("tips"), list) and len(data["tips"]) > 0:
                break
            data = None
        except Exception as e:
            logger.error(f"insights LLM error: {e}")
            data = None

    if not data:
        fb = _fallback_insights(req, score, adj_goal)
        return {
            "score": score,
            "adjusted_goal": adj_goal,
            "score_reasons": reasons,
            "summary": fb["summary"],
            "tips": fb["tips"],
            "prediction": fb["prediction"],
        }

    tips = []
    for tp in data.get("tips", [])[:3]:
        if isinstance(tp, dict) and tp.get("text"):
            tips.append({"text": str(tp["text"]), "reason": str(tp.get("reason", ""))})
        elif isinstance(tp, str):
            tips.append({"text": tp, "reason": ""})
    if not tips:
        fb = _fallback_insights(req, score, adj_goal)
        tips = fb["tips"]
    return {
        "score": score,
        "adjusted_goal": adj_goal,
        "score_reasons": reasons,
        "summary": data.get("summary", "") or _fallback_insights(req, score, adj_goal)["summary"],
        "tips": tips,
        "prediction": data.get("prediction", ""),
    }


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
