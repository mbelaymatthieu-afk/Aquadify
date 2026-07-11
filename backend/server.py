from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
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
class InsightsRequest(BaseModel):
    goal: int = 2000
    average: float = 0
    days_achieved: int = 0
    total_days: int = 7
    current_streak: int = 0
    best_streak: int = 0
    recent: List[dict] = []
    language: str = "fr"


@api_router.post("/insights")
async def hydration_insights(req: InsightsRequest):
    import json as _json
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    key = os.environ.get("EMERGENT_LLM_KEY")
    lang_name = {"fr": "French", "en": "English", "es": "Spanish"}.get(req.language, "French")
    system = (
        "You are Aquadify, a warm, encouraging hydration wellness coach. "
        "Give concise, motivating, strictly NON-medical guidance based on the user's hydration habits. "
        f"Always answer in {lang_name}. "
        'Return ONLY valid minified JSON with this exact shape: '
        '{"summary": "one encouraging sentence <=160 chars", "tips": ["tip1","tip2","tip3"]}. '
        "Each tip must be short (<=90 chars) and actionable. No markdown, no extra text."
    )
    stats = (
        f"Daily goal: {req.goal} ml. 7-day average intake: {round(req.average)} ml. "
        f"Days goal reached: {req.days_achieved}/{req.total_days}. "
        f"Current streak: {req.current_streak} days, best streak: {req.best_streak} days. "
        f"Recent daily totals (date,total,goal): {req.recent}."
    )
    try:
        chat = LlmChat(api_key=key, session_id=f"insights-{uuid.uuid4().hex[:8]}", system_message=system)
        chat.with_model("openai", "gpt-4o-mini")
        text = await chat.send_message(UserMessage(text=stats))
        raw = (text or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:]
        data = _json.loads(raw)
        tips = [t for t in data.get("tips", []) if isinstance(t, str)][:3]
        return {"summary": data.get("summary", ""), "tips": tips}
    except Exception as e:
        logger.error(f"insights error: {e}")
        return {"summary": "", "tips": [], "error": True}


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
