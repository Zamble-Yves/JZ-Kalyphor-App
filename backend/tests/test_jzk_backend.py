"""Backend API tests for JZ KALYPHOR."""
import os, io, pytest, requests
from PIL import Image

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://jz-kalyphor-track.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "jeanjonathanzamble@gmail.com", "password": "Kalyphor2026!"}
STUDENT = {"email": "amina.kone@demo.ci", "password": "Demo2026!"}

session = requests.Session()
state = {}

def _login(creds):
    r = session.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()

@pytest.fixture(scope="module", autouse=True)
def setup():
    a = _login(ADMIN); s = _login(STUDENT)
    state["admin_token"] = a["token"]; state["admin"] = a["user"]
    state["student_token"] = s["token"]; state["student"] = s["user"]

def hA(): return {"Authorization": f"Bearer {state['admin_token']}"}
def hS(): return {"Authorization": f"Bearer {state['student_token']}"}

# ---- Auth ----
def test_admin_login_role():
    assert state["admin"]["role"] == "admin"

def test_student_login_role():
    assert state["student"]["role"] == "student"

def test_bad_login():
    r = session.post(f"{API}/auth/login", json={"email": "nope@x.com", "password": "bad"})
    assert r.status_code == 401

def test_me():
    r = session.get(f"{API}/auth/me", headers=hA()); assert r.status_code == 200
    assert r.json()["email"] == ADMIN["email"].lower()

def test_me_invalid_token():
    r = session.get(f"{API}/auth/me", headers={"Authorization": "Bearer bad"})
    assert r.status_code == 401

def test_put_me_welcome():
    r = session.put(f"{API}/auth/me", headers=hS(), json={"welcome_seen": True})
    assert r.status_code == 200 and r.json()["welcome_seen"] is True

# ---- Students ----
def test_list_students_admin():
    r = session.get(f"{API}/students", headers=hA()); assert r.status_code == 200
    data = r.json(); assert len(data) >= 4
    emails = [u["email"] for u in data]
    assert "amina.kone@demo.ci" in emails

def test_list_students_filter_cohort():
    r = session.get(f"{API}/students?cohort=2026-01", headers=hA())
    assert r.status_code == 200
    assert all(u["cohort"] == "2026-01" for u in r.json())

def test_list_students_filter_status_late():
    r = session.get(f"{API}/students?status=late", headers=hA())
    assert r.status_code == 200
    assert all(u["status"] == "late" for u in r.json())

def test_student_cannot_list_students():
    r = session.get(f"{API}/students", headers=hS()); assert r.status_code == 403

def test_create_and_update_and_note_student():
    payload = {"email": "TEST_newstu@example.com", "name": "TEST Stu", "password": "Pass123!",
               "cohort": "2026-03", "certificate": "Test Cert"}
    r = session.post(f"{API}/students", headers=hA(), json=payload)
    assert r.status_code == 200, r.text
    sid = r.json()["id"]; state["new_sid"] = sid
    g = session.get(f"{API}/students/{sid}", headers=hA())
    assert g.status_code == 200 and g.json()["email"] == payload["email"].lower()
    assert "note" in g.json()
    u = session.put(f"{API}/students/{sid}", headers=hA(), json={"name": "TEST Updated"})
    assert u.status_code == 200 and u.json()["name"] == "TEST Updated"
    n = session.put(f"{API}/students/{sid}/note", headers=hA(), json={"note": "coach note"})
    assert n.status_code == 200
    g2 = session.get(f"{API}/students/{sid}", headers=hA())
    assert g2.json()["note"] == "coach note"

def test_student_cannot_create():
    r = session.post(f"{API}/students", headers=hS(), json={"email": "x@y.z", "name": "x", "password": "x"})
    assert r.status_code == 403

# ---- Courses ----
def test_me_courses():
    r = session.get(f"{API}/me/courses", headers=hS())
    assert r.status_code == 200 and len(r.json()) >= 1
    state["course_id"] = r.json()[0]["id"]
    # verify sorted by order
    orders = [c["order"] for c in r.json()]
    assert orders == sorted(orders)

def test_student_update_course_status_only():
    cid = state["course_id"]
    r = session.put(f"{API}/courses/{cid}", headers=hS(), json={"status": "in_progress", "title": "HACK"})
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"
    assert r.json()["title"] != "HACK"

def test_admin_add_course():
    sid = state["new_sid"]
    r = session.post(f"{API}/students/{sid}/courses", headers=hA(),
                     json={"title": "TEST course", "link_type": "youtube", "url": "https://y/1", "status": "todo"})
    assert r.status_code == 200 and r.json()["title"] == "TEST course"

# ---- Proofs ----
def test_upload_proof():
    img = Image.new("RGB", (10, 10), "red"); buf = io.BytesIO(); img.save(buf, "PNG"); buf.seek(0)
    files = {"file": ("t.png", buf, "image/png")}
    r = session.post(f"{API}/proofs", headers=hS(), files=files, data={"comment": "test"})
    assert r.status_code == 200, r.text
    assert r.json()["user_id"] == state["student"]["id"]
    lst = session.get(f"{API}/me/proofs", headers=hS())
    assert lst.status_code == 200 and len(lst.json()) >= 1

# ---- Admin ----
def test_admin_stats():
    r = session.get(f"{API}/admin/stats", headers=hA())
    assert r.status_code == 200
    j = r.json(); assert "totals" in j and "cohorts" in j
    assert j["totals"]["total_students"] >= 4

def test_admin_late():
    r = session.get(f"{API}/admin/late", headers=hA())
    assert r.status_code == 200
    assert all(u["status"] == "late" for u in r.json())

# ---- Messages ----
def test_messages_flow():
    admin_id = state["admin"]["id"]; stu_id = state["student"]["id"]
    s = session.post(f"{API}/messages", headers=hS(), json={"to_user_id": admin_id, "content": "TEST hello"})
    assert s.status_code == 200
    a = session.post(f"{API}/messages", headers=hA(), json={"to_user_id": stu_id, "content": "TEST reply"})
    assert a.status_code == 200
    r = session.get(f"{API}/messages", headers=hS())
    assert r.status_code == 200 and len(r.json()) >= 2
    r2 = session.get(f"{API}/messages?with_user={stu_id}", headers=hA())
    assert r2.status_code == 200 and len(r2.json()) >= 2
    r3 = session.get(f"{API}/messages", headers=hA())
    assert r3.status_code == 400  # with_user required for admin

# ---- Cleanup ----
def test_zz_cleanup():
    sid = state.get("new_sid")
    if sid:
        r = session.delete(f"{API}/students/{sid}", headers=hA())
        assert r.status_code == 200
