# Robustness test — iteration 10: /api/insights must NEVER return empty tips or prediction.
# The endpoint now retries once and falls back to a deterministic FR/EN/ES payload.
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_BACKEND_URL", "https://aquadify-storekit.preview.emergentagent.com"
).rstrip("/")
INSIGHTS_URL = f"{BASE_URL}/api/insights"

SAMPLE = {
    "goal": 2350,
    "consumed_today": 1200,
    "logs_today": 4,
    "hour_of_day": 14,
    "health": {
        "steps": 8200,
        "sleep_hours": 7.5,
        "temperature_c": 22,
        "resting_heart_rate": 62,
    },
}


def _assert_full_shape(data):
    assert isinstance(data.get("score"), int)
    assert 0 <= data["score"] <= 100
    assert isinstance(data.get("adjusted_goal"), int) and data["adjusted_goal"] >= 1
    tips = data.get("tips")
    assert isinstance(tips, list) and len(tips) >= 1, f"tips empty! got: {data}"
    for t in tips:
        assert isinstance(t, dict)
        assert isinstance(t.get("text"), str) and len(t["text"]) > 0, t
        assert isinstance(t.get("reason", ""), str) and len(t.get("reason", "")) > 0, t
    pred = data.get("prediction")
    assert isinstance(pred, str) and len(pred) > 0, f"prediction empty! data={data}"


@pytest.mark.parametrize("i", range(6))
def test_insights_fr_never_empty(i):
    r = requests.post(INSIGHTS_URL, json={**SAMPLE, "language": "fr"}, timeout=60)
    assert r.status_code == 200, r.text
    _assert_full_shape(r.json())


def test_insights_en_never_empty():
    r = requests.post(INSIGHTS_URL, json={**SAMPLE, "language": "en"}, timeout=60)
    assert r.status_code == 200, r.text
    _assert_full_shape(r.json())


def test_insights_minimal_never_empty():
    r = requests.post(INSIGHTS_URL, json={"language": "fr"}, timeout=60)
    assert r.status_code == 200, r.text
    _assert_full_shape(r.json())
