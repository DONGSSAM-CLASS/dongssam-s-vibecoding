"""배포용 기능: 설정 저장·암호화, 로컬 서버 보안, 기록 정리."""

from __future__ import annotations

import json
import os
import time

import pytest
from fastapi.testclient import TestClient

from pumui import paths
from pumui.config import Settings, load_user_config, save_user_config
from pumui.housekeeping import _ver, add_history, cleanup_runs, load_history
from pumui.models import PumuiDraft, PumuiItem
from pumui.playbook import build_system_prompt
from pumui.secret_store import seal, unseal


def test_secret_roundtrip():
    sealed = seal("sk-ant-테스트-1234")
    assert "sk-ant" not in json.dumps(sealed) or sealed["scheme"] == "plain"
    assert unseal(sealed) == "sk-ant-테스트-1234"
    assert unseal({"scheme": "dpapi", "data": "!!!"}) == ""
    assert unseal(None) == ""


def test_settings_precedence_and_secrets(monkeypatch):
    monkeypatch.setenv("PUMUI_REGION", "goe")
    assert Settings().region == "goe"                       # 환경변수
    save_user_config({"region": "pen", "api_key": "sk-ant-abcd9999", "retention_days": 7})
    s = Settings()
    assert s.region == "pen"                                 # 설정 화면 값이 우선
    assert s.api_key == "sk-ant-abcd9999" and s.retention_days == 7
    raw = paths.config_file().read_text(encoding="utf-8")
    assert "abcd9999" not in raw or os.name != "nt"          # Windows에서는 암호화되어 평문이 없음
    pub = s.public()
    assert pub["api_key_saved"] and pub["api_key_hint"] == "…9999" and "api_key" not in pub
    save_user_config({"api_key": None})                      # None = 변경 없음
    assert Settings().api_key == "sk-ant-abcd9999"
    save_user_config({"api_key": ""})                        # 빈 문자열 = 삭제
    assert Settings().api_key == ""
    assert "api_key" not in load_user_config()


def test_school_notes_in_prompt():
    d = PumuiDraft(title="t", purpose="p", items=[PumuiItem(name="a", quantity=1, unit_price=1)]).ensure_overview()
    sp = build_system_prompt(d, "submit", "", "품의목록은 '학교회계 > 품의관리'에 있음")
    assert "우리 학교/교육청 참고사항" in sp and "품의관리" in sp
    assert "참고사항" not in build_system_prompt(d, "submit", "", "")


def test_history_and_cleanup():
    add_history({"title": "우드락 구입", "items": [{"quantity": 10, "unit_price": 3000}]}, "saved", "00874")
    h = load_history()
    assert h[0]["title"] == "우드락 구입" and h[0]["total"] == 30000
    old = paths.runs_dir() / "20200101-000000"
    old.mkdir(parents=True, exist_ok=True)
    (old / "screen_001.png").write_bytes(b"x")
    past = time.time() - 40 * 86400
    os.utime(old, (past, past))
    new = paths.runs_dir() / "new"
    new.mkdir(exist_ok=True)
    assert cleanup_runs(30) == 1
    assert not old.exists() and new.exists()


def test_version_compare():
    assert _ver("v1.2.0") > _ver("1.0.9")
    assert _ver("v1.0.0") == _ver("1.0.0")


@pytest.fixture()
def client():
    from pumui.server import app, state

    state.set_port(8765)
    state.allowed_hosts.add("testserver")
    return TestClient(app), state


def test_server_requires_token_and_host(client):
    c, state = client
    assert c.get("/api/ping").json()["app"] == "pumui"                      # 토큰 없이 허용
    assert c.get("/api/config").status_code == 403                          # 토큰 없음
    assert c.get("/api/config", headers={"X-Pumui-Token": "wrong"}).status_code == 403
    ok = c.get("/api/config", headers={"X-Pumui-Token": state.token})
    assert ok.status_code == 200 and "api_key" not in ok.json()
    assert c.get(f"/api/events?t=wrong").status_code == 403
    # 다른 사이트가 DNS 리바인딩으로 접근하는 경우 차단
    assert c.get("/", headers={"Host": "evil.example:8765"}).status_code == 403
    assert c.get("/mock/portal.html").status_code == 200


def test_server_settings_validation_and_no_key(client):
    c, state = client
    h = {"X-Pumui-Token": state.token}
    assert c.post("/api/settings", json={"region": "xxx"}, headers=h).status_code == 400
    assert c.post("/api/settings", json={"portal_url": "http://evil"}, headers=h).status_code == 400
    r = c.post("/api/settings", json={"region": "goe", "school_notes": "메모", "unknown": 1}, headers=h)
    assert r.status_code == 200 and r.json()["region"] == "goe"
    assert "unknown" not in load_user_config()
    assert c.post("/api/agree", headers=h).json()["ok"]
    assert c.get("/api/config", headers=h).json()["agreed"] is True
    draft = {"title": "t", "purpose": "p", "items": [{"name": "a", "quantity": 1, "unit_price": 100}]}
    r = c.post("/api/run", json={"draft": draft, "mock": True}, headers=h)
    assert r.status_code == 401 and "API 키" in r.json()["detail"]
    r = c.post("/api/draft", json={"text": "우드락"}, headers=h)
    assert r.status_code == 401
    assert c.post("/api/test-key", json={}, headers=h).json()["ok"] is False
    assert c.get("/api/history", headers=h).json() == []
