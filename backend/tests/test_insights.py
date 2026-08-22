# Tests for LOCAL backend AI hydration insights endpoint (Emergent LLM).
# Iteration 9 (Jan 2026): endpoint now returns score/100 + adjusted_goal + score_reasons
# + summary + tips[{text,reason}] + prediction (see backend/server.py::hydration_insights).
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://aquadify-storekit.preview.emergentagent.com").rstrip("/")
INSIGHTS_URL = f"{BASE_URL}/api/insights"

# --- Realistic sample payload (mid-day, partial hydration, moderate activity) ---
BASE_PAYLOAD = {
    "goal": 2350,
    "consumed_today": 1200,
    "logs_today": 4,
    "last_intake_hours": 1.5,
    "hour_of_day": 14,
    "average": 1600,
    "days_achieved": 3,
    "total_days": 7,
    "current_streak": 2,
    "best_streak": 4,
    "recent": [
        {"date": "2026-01-05", "total": 2100, "goal": 2350},
        {"date": "2026-01-06", "total": 1850, "goal": 2350},
        {"date": "2026-01-07", "total": 2400, "goal": 2350},
    ],
    "activity_trend": [{"date": "2026-01-07", "steps": 8200, "active_energy": 380}],
    "health": {
        "steps": 8200,
        "active_energy": 380,
        "sleep_hours": 7.5,
        "resting_heart_rate": 62,
        "workout_minutes": 30,
        "temperature_c": 22,
    },
}


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health / smoke ---
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"


# --- Deterministic score contract (score, adjusted_goal, reasons) ---
class TestInsightsScoreContract:
    def _assert_score_shape(self, data):
        assert isinstance(data.get("score"), int), data
        assert 0 <= data["score"] <= 100, data
        assert isinstance(data.get("adjusted_goal"), int) and data["adjusted_goal"] >= 1, data
        assert isinstance(data.get("score_reasons"), list) and len(data["score_reasons"]) >= 1, data
        for r in data["score_reasons"]:
            assert isinstance(r, str) and len(r) > 0

    def test_insights_french_full_shape(self, api_client):
        payload = {**BASE_PAYLOAD, "language": "fr"}
        r = api_client.post(INSIGHTS_URL, json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        self._assert_score_shape(data)
        # Score should be present even if LLM fails
        # In success path we also expect summary + tips[{text,reason}] + prediction
        assert isinstance(data.get("summary"), str)
        tips = data.get("tips")
        assert isinstance(tips, list), data
        if not data.get("error"):
            assert 1 <= len(tips) <= 3, data
            for t in tips:
                assert isinstance(t, dict), t
                assert isinstance(t.get("text"), str) and len(t["text"]) > 0, t
                # reason may be empty string but must be a string
                assert isinstance(t.get("reason", ""), str), t
            assert isinstance(data.get("prediction"), str)

    def test_insights_english(self, api_client):
        payload = {**BASE_PAYLOAD, "language": "en"}
        r = api_client.post(INSIGHTS_URL, json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        self._assert_score_shape(data)
        if not data.get("error"):
            assert isinstance(data.get("summary"), str) and len(data["summary"]) > 0
            assert isinstance(data.get("tips"), list) and 1 <= len(data["tips"]) <= 3

    def test_insights_minimal_defaults(self, api_client):
        # Minimal body should still work thanks to Pydantic defaults + deterministic score fallback
        r = api_client.post(INSIGHTS_URL, json={"language": "fr"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("score"), int)
        assert 0 <= data["score"] <= 100

    def test_activity_bonus_raises_adjusted_goal(self, api_client):
        # Heavy activity + hot weather should raise adjusted_goal above the base goal
        payload = {
            **BASE_PAYLOAD,
            "language": "fr",
            "health": {
                "steps": 15000,
                "active_energy": 600,
                "workout_minutes": 90,
                "temperature_c": 32,
                "sleep_hours": 7,
                "resting_heart_rate": 60,
            },
        }
        r = api_client.post(INSIGHTS_URL, json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["adjusted_goal"] > payload["goal"], data

    def test_no_health_still_works(self, api_client):
        # Web / non-iOS path: no health snapshot -> adjusted_goal == goal
        payload = {**BASE_PAYLOAD, "language": "fr", "health": None}
        r = api_client.post(INSIGHTS_URL, json=payload, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["adjusted_goal"] == payload["goal"], data
        assert 0 <= data["score"] <= 100
