# Tests for LOCAL backend AI hydration insights endpoint (Emergent LLM).
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://fastapi-mobile-port.preview.emergentagent.com").rstrip("/")
INSIGHTS_URL = f"{BASE_URL}/api/insights"

BASE_PAYLOAD = {
    "goal": 2350,
    "average": 1600,
    "days_achieved": 3,
    "total_days": 7,
    "current_streak": 2,
    "best_streak": 4,
    "recent": [{"date": "2026-07-05", "total": 2100, "goal": 2350}],
}


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"


class TestInsights:
    """POST /api/insights — Aquadify AI hydration insights."""

    def test_insights_french(self, api_client):
        payload = {**BASE_PAYLOAD, "language": "fr"}
        r = api_client.post(INSIGHTS_URL, json=payload, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert not data.get("error"), f"insights error flag set: {data}"
        assert isinstance(data.get("summary"), str) and len(data["summary"]) > 0, data
        tips = data.get("tips")
        assert isinstance(tips, list) and 1 <= len(tips) <= 3, data
        for t in tips:
            assert isinstance(t, str) and len(t) > 0

    def test_insights_english(self, api_client):
        payload = {**BASE_PAYLOAD, "language": "en"}
        r = api_client.post(INSIGHTS_URL, json=payload, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        assert not data.get("error"), data
        summary = data.get("summary", "")
        tips = data.get("tips", [])
        assert isinstance(summary, str) and len(summary) > 0
        assert isinstance(tips, list) and 1 <= len(tips) <= 3
        # Heuristic English check: common English stopwords likely appear
        joined = (summary + " " + " ".join(tips)).lower()
        english_hits = sum(1 for w in [" the ", " you ", " your ", " to ", " and ", " a ", " of ", " with ", " day", " water"] if w.strip() in joined)
        assert english_hits >= 2, f"Response does not look English: {data}"

    def test_insights_defaults(self, api_client):
        # Minimal body should still work thanks to Pydantic defaults
        r = api_client.post(INSIGHTS_URL, json={"language": "fr"}, timeout=45)
        assert r.status_code == 200, r.text
        data = r.json()
        # even with zero stats the LLM should give a summary; error flag must be false
        assert not data.get("error"), data
        assert isinstance(data.get("summary"), str)
        assert isinstance(data.get("tips"), list)
