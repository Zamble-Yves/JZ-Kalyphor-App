from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form, Query
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
import os, uuid, logging, jwt, bcrypt, requests, secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ['JWT_SECRET']
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
ADMIN_NAME = os.environ['ADMIN_NAME']
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "jz-kalyphor"
_storage_key: Optional[str] = None

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger("jzk")

# ---------------------------- Models ----------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Literal["student", "admin"]
    phone: Optional[str] = None
    certificate: Optional[str] = None
    cohort: Optional[str] = None  # YYYY-MM
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    progress: int = 0
    status: Literal["in_progress", "late", "completed"] = "in_progress"
    first_login: bool = True
    welcome_seen: bool = False

class StudentCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    phone: Optional[str] = None
    certificate: Optional[str] = None
    cohort: Optional[str] = None
    start_date: Optional[str] = None
    deadline: Optional[str] = None

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    certificate: Optional[str] = None
    cohort: Optional[str] = None
    start_date: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[Literal["in_progress", "late", "completed"]] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    welcome_seen: Optional[bool] = None

class CourseIn(BaseModel):
    title: str
    link_type: Literal["youtube", "pdf", "external"]
    url: str
    status: Literal["todo", "in_progress", "done"] = "todo"
    access_email: Optional[str] = None
    access_password: Optional[str] = None

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    link_type: Optional[Literal["youtube", "pdf", "external"]] = None
    url: Optional[str] = None
    status: Optional[Literal["todo", "in_progress", "done"]] = None
    favorite: Optional[bool] = None
    access_email: Optional[str] = None
    access_password: Optional[str] = None

class TimeLogIn(BaseModel):
    minutes: int

class MessageIn(BaseModel):
    to_user_id: str
    content: str

class NoteUpdate(BaseModel):
    note: str

# ---------------------------- Helpers ----------------------------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception: return False

def make_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def make_file_token(path: str) -> str:
    payload = {"path": path, "exp": datetime.now(timezone.utc) + timedelta(hours=2)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

async def admin_only(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Admin only")
    return user

def user_to_out(u: dict) -> dict:
    return {k: u.get(k) for k in UserOut.model_fields.keys()}

def compute_progress(courses: List[dict]) -> int:
    if not courses: return 0
    done = sum(1 for c in courses if c.get("status") == "done")
    return int(round(done * 100 / len(courses)))

async def recompute_user_stats(user_id: str):
    courses = await db.courses.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    progress = compute_progress(courses)
    # last proof date
    last_proof = await db.proofs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(1)
    last_proof_at = last_proof[0]["created_at"] if last_proof else None
    status = "in_progress"
    if progress >= 100: status = "completed"
    else:
        # Late if deadline passed OR no proof in 7 days
        is_late = False
        if last_proof_at:
            try:
                d = datetime.fromisoformat(last_proof_at)
                if (datetime.now(timezone.utc) - d).days > 7: is_late = True
            except: pass
        else:
            is_late = True
        if is_late: status = "late"
    await db.users.update_one({"id": user_id}, {"$set": {"progress": progress, "status": status, "last_proof_at": last_proof_at}})

# ---------------------------- Storage ----------------------------
def _init_storage():
    global _storage_key
    if _storage_key: return _storage_key
    r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key

def _put(path: str, data: bytes, content_type: str) -> dict:
    key = _init_storage()
    r = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def _get(path: str) -> tuple:
    global _storage_key
    key = _init_storage()
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 503:
        _storage_key = None
        key = _init_storage()
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------------------------- Auth Routes ----------------------------
@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not verify_pw(body.password, u.get("password", "")):
        raise HTTPException(401, "Email ou mot de passe incorrect")
    token = make_token(u["id"], u["role"])
    return {"token": token, "user": user_to_out(u)}

@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user_to_out(user)

@api.put("/auth/me")
async def update_me(body: ProfileUpdate, user=Depends(current_user)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch:
        await db.users.update_one({"id": user["id"]}, {"$set": patch})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return user_to_out(u)

# ---------------------------- Students (Admin) ----------------------------
@api.get("/students")
async def list_students(cohort: Optional[str] = None, status: Optional[str] = None, admin=Depends(admin_only)):
    q = {"role": "student"}
    if cohort: q["cohort"] = cohort
    if status: q["status"] = status
    users = await db.users.find(q, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        await recompute_user_stats(u["id"])
    users = await db.users.find(q, {"_id": 0, "password": 0}).to_list(1000)
    return [user_to_out(u) for u in users]

@api.post("/students")
async def create_student(body: StudentCreate, admin=Depends(admin_only)):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email déjà utilisé")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": body.email.lower(), "name": body.name, "role": "student",
        "password": hash_pw(body.password), "phone": body.phone, "certificate": body.certificate,
        "cohort": body.cohort, "start_date": body.start_date, "deadline": body.deadline,
        "progress": 0, "status": "in_progress", "first_login": True, "welcome_seen": False,
        "note": "", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    return user_to_out(u)

@api.get("/students/{sid}")
async def get_student(sid: str, admin=Depends(admin_only)):
    await recompute_user_stats(sid)
    u = await db.users.find_one({"id": sid}, {"_id": 0, "password": 0})
    if not u: raise HTTPException(404, "Non trouvé")
    out = user_to_out(u)
    out["note"] = u.get("note", "")
    return out

@api.put("/students/{sid}")
async def update_student(sid: str, body: StudentUpdate, admin=Depends(admin_only)):
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if patch: await db.users.update_one({"id": sid}, {"$set": patch})
    u = await db.users.find_one({"id": sid}, {"_id": 0, "password": 0})
    return user_to_out(u)

@api.put("/students/{sid}/note")
async def update_note(sid: str, body: NoteUpdate, admin=Depends(admin_only)):
    await db.users.update_one({"id": sid}, {"$set": {"note": body.note}})
    return {"ok": True, "note": body.note}

@api.delete("/students/{sid}")
async def delete_student(sid: str, admin=Depends(admin_only)):
    await db.users.delete_one({"id": sid, "role": "student"})
    await db.courses.delete_many({"user_id": sid})
    await db.proofs.delete_many({"user_id": sid})
    return {"ok": True}

# ---------------------------- Courses ----------------------------
@api.get("/me/courses")
async def my_courses(user=Depends(current_user)):
    return await db.courses.find({"user_id": user["id"]}, {"_id": 0}).sort("order", 1).to_list(1000)

@api.get("/students/{sid}/courses")
async def student_courses(sid: str, admin=Depends(admin_only)):
    return await db.courses.find({"user_id": sid}, {"_id": 0}).sort("order", 1).to_list(1000)

@api.post("/students/{sid}/courses")
async def add_course(sid: str, body: CourseIn, admin=Depends(admin_only)):
    count = await db.courses.count_documents({"user_id": sid})
    doc = {"id": str(uuid.uuid4()), "user_id": sid, "order": count, **body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.courses.insert_one(doc)
    await recompute_user_stats(sid)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.put("/courses/{cid}")
async def update_course(cid: str, body: CourseUpdate, user=Depends(current_user)):
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Non trouvé")
    if user["role"] != "admin" and c["user_id"] != user["id"]:
        raise HTTPException(403, "Non autorisé")
    patch = body.model_dump(exclude_unset=True)
    if user["role"] != "admin":
        # Students can only update status and favorite
        patch = {k: v for k, v in patch.items() if k in ("status", "favorite")}
    patch = {k: v for k, v in patch.items() if v is not None}
    if patch: await db.courses.update_one({"id": cid}, {"$set": patch})
    await recompute_user_stats(c["user_id"])
    c2 = await db.courses.find_one({"id": cid}, {"_id": 0})
    return c2

@api.post("/courses/{cid}/log-time")
async def log_time(cid: str, body: TimeLogIn, user=Depends(current_user)):
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Non trouvé")
    if user["role"] != "admin" and c["user_id"] != user["id"]:
        raise HTTPException(403, "Non autorisé")
    if body.minutes <= 0 or body.minutes > 24 * 60:
        raise HTTPException(400, "Durée invalide")
    await db.courses.update_one({"id": cid}, {"$inc": {"time_spent_minutes": body.minutes}})
    await db.time_logs.insert_one({
        "id": str(uuid.uuid4()), "course_id": cid, "user_id": c["user_id"],
        "minutes": body.minutes, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    c2 = await db.courses.find_one({"id": cid}, {"_id": 0})
    return c2

@api.get("/me/estimate")
async def my_estimate(user=Depends(current_user)):
    courses = await db.courses.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    if not courses:
        return {"estimated_days": None, "estimated_date": None, "avg_minutes_done": 0, "remaining_courses": 0, "total_minutes_spent": 0}
    done = [c for c in courses if c.get("status") == "done"]
    remaining = [c for c in courses if c.get("status") != "done"]
    total_minutes = sum(c.get("time_spent_minutes", 0) or 0 for c in courses)
    done_with_time = [c for c in done if (c.get("time_spent_minutes") or 0) > 0]
    if done_with_time:
        avg = sum(c["time_spent_minutes"] for c in done_with_time) / len(done_with_time)
    elif done and total_minutes > 0:
        avg = total_minutes / len(done)
    else:
        avg = 45.0  # default assumption: 45 min per course
    est_minutes = int(avg * len(remaining))
    # assume 60 min of study per day
    est_days = max(1, int(round(est_minutes / 60.0)))
    est_date = (datetime.now(timezone.utc) + timedelta(days=est_days)).date().isoformat() if remaining else None
    return {
        "estimated_days": est_days if remaining else 0,
        "estimated_date": est_date,
        "avg_minutes_done": int(round(avg)),
        "remaining_courses": len(remaining),
        "total_minutes_spent": total_minutes,
    }

@api.delete("/courses/{cid}")
async def delete_course(cid: str, admin=Depends(admin_only)):
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c: raise HTTPException(404, "Non trouvé")
    await db.courses.delete_one({"id": cid})
    await db.time_logs.delete_many({"course_id": cid})
    await recompute_user_stats(c["user_id"])
    return {"ok": True}

# ---------------------------- Proofs ----------------------------
@api.post("/proofs")
async def upload_proof(file: UploadFile = File(...), comment: str = Form(""), user=Depends(current_user)):
    data = await file.read()
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    ct = file.content_type or "image/jpeg"
    await run_in_threadpool(_put, path, data, ct)
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "storage_path": path,
        "content_type": ct, "comment": comment, "filename": file.filename or f"image.{ext}",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.proofs.insert_one(doc)
    await recompute_user_stats(user["id"])
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/me/proofs")
async def my_proofs(user=Depends(current_user)):
    return await db.proofs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.get("/students/{sid}/proofs")
async def student_proofs(sid: str, admin=Depends(admin_only)):
    return await db.proofs.find({"user_id": sid}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api.get("/proof-url/{proof_id}")
async def proof_url(proof_id: str, user=Depends(current_user)):
    p = await db.proofs.find_one({"id": proof_id}, {"_id": 0})
    if not p: raise HTTPException(404, "Non trouvé")
    if user["role"] != "admin" and p["user_id"] != user["id"]:
        raise HTTPException(403, "Non autorisé")
    token = make_file_token(p["storage_path"])
    return {"url": f"/api/files/{p['storage_path']}?token={token}", "token": token, "path": p["storage_path"]}

@api.get("/files/{path:path}")
async def get_file(path: str, token: Optional[str] = None, auth: Optional[str] = Header(None)):
    allowed = False
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if payload.get("path") == path: allowed = True
        except Exception: pass
    if not allowed and auth and auth.lower().startswith("bearer "):
        # authenticated user with access to proof
        try:
            p = jwt.decode(auth.split()[1], JWT_SECRET, algorithms=["HS256"])
            proof = await db.proofs.find_one({"storage_path": path}, {"_id": 0})
            if proof and (p.get("role") == "admin" or proof["user_id"] == p.get("sub")):
                allowed = True
        except Exception: pass
    if not allowed: raise HTTPException(403, "Non autorisé")
    try:
        content, ct = await run_in_threadpool(_get, path)
    except Exception as e:
        log.error(f"storage get error: {e}")
        raise HTTPException(404, "Fichier non trouvé")
    return Response(content=content, media_type=ct)

# ---------------------------- Messages ----------------------------
@api.get("/messages")
async def list_messages(with_user: Optional[str] = None, user=Depends(current_user)):
    # Student messages always with admin; admin passes with_user=student id
    other = None
    if user["role"] == "admin":
        if not with_user: raise HTTPException(400, "with_user requis")
        other = with_user
    else:
        admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1})
        other = admin["id"] if admin else None
    if not other: return []
    msgs = await db.messages.find({
        "$or": [{"from_user": user["id"], "to_user": other}, {"from_user": other, "to_user": user["id"]}]
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs

@api.post("/messages")
async def send_message(body: MessageIn, user=Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "from_user": user["id"], "to_user": body.to_user_id,
           "content": body.content, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.messages.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/admin/id")
async def admin_id():
    a = await db.users.find_one({"role": "admin"}, {"_id": 0, "id": 1, "name": 1})
    return a or {}

# ---------------------------- Admin Stats ----------------------------
@api.get("/admin/stats")
async def admin_stats(admin=Depends(admin_only)):
    users = await db.users.find({"role": "student"}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        await recompute_user_stats(u["id"])
    users = await db.users.find({"role": "student"}, {"_id": 0, "password": 0}).to_list(1000)
    # by cohort
    by_cohort = {}
    for u in users:
        c = u.get("cohort") or "N/A"
        d = by_cohort.setdefault(c, {"cohort": c, "total": 0, "late": 0, "completed": 0, "progress_sum": 0})
        d["total"] += 1
        if u.get("status") == "late": d["late"] += 1
        if u.get("status") == "completed": d["completed"] += 1
        d["progress_sum"] += u.get("progress", 0)
    series = []
    for c in sorted(by_cohort.keys()):
        d = by_cohort[c]
        d["avg_progress"] = int(round(d["progress_sum"] / d["total"])) if d["total"] else 0
        series.append(d)
    totals = {
        "total_students": len(users),
        "in_progress": sum(1 for u in users if u.get("status") == "in_progress"),
        "late": sum(1 for u in users if u.get("status") == "late"),
        "completed": sum(1 for u in users if u.get("status") == "completed"),
        "avg_progress": int(round(sum(u.get("progress", 0) for u in users) / len(users))) if users else 0,
    }
    return {"totals": totals, "cohorts": series}

@api.get("/admin/late")
async def late_students(admin=Depends(admin_only)):
    users = await db.users.find({"role": "student"}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        await recompute_user_stats(u["id"])
    users = await db.users.find({"role": "student", "status": "late"}, {"_id": 0, "password": 0}).to_list(1000)
    return [user_to_out(u) for u in users]

# ---------------------------- Startup Seeding ----------------------------
async def seed():
    # Admin
    if not await db.users.find_one({"email": ADMIN_EMAIL.lower()}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": ADMIN_EMAIL.lower(), "name": ADMIN_NAME,
            "role": "admin", "password": hash_pw(ADMIN_PASSWORD),
            "phone": "+2250700921922", "progress": 0, "status": "in_progress",
            "first_login": False, "welcome_seen": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        log.info("Admin seeded")
    # Demo students if none exist
    student_count = await db.users.count_documents({"role": "student"})
    if student_count == 0:
        demos = [
            {"email": "amina.kone@demo.ci", "name": "Amina Koné", "password": "Demo2026!", "phone": "+2250709123456",
             "certificate": "Google Analytics Certified", "cohort": "2026-01",
             "start_date": "2026-01-15", "deadline": "2026-04-15"},
            {"email": "yao.diomande@demo.ci", "name": "Yao Diomandé", "password": "Demo2026!", "phone": "+2250709123457",
             "certificate": "Meta Blueprint Media Buying", "cohort": "2026-01",
             "start_date": "2026-01-20", "deadline": "2026-05-20"},
            {"email": "fatou.traore@demo.ci", "name": "Fatou Traoré", "password": "Demo2026!", "phone": "+2250709123458",
             "certificate": "HubSpot Inbound Marketing", "cohort": "2026-02",
             "start_date": "2026-02-01", "deadline": "2026-06-01"},
            {"email": "koffi.aka@demo.ci", "name": "Koffi Aka", "password": "Demo2026!", "phone": "+2250709123459",
             "certificate": "Google Ads Search", "cohort": "2026-02",
             "start_date": "2026-02-10", "deadline": "2026-05-10"},
        ]
        course_tpl = [
            {"title": "Introduction au certificat", "link_type": "youtube", "url": "https://youtu.be/dQw4w9WgXcQ", "status": "done"},
            {"title": "Module 1 - Fondamentaux (PDF)", "link_type": "pdf", "url": "https://example.com/mod1.pdf", "status": "done"},
            {"title": "Plateforme officielle - Exercice", "link_type": "external", "url": "https://skillshop.exceedlms.com", "status": "in_progress"},
            {"title": "Module 2 - Approfondissement", "link_type": "youtube", "url": "https://youtu.be/dQw4w9WgXcQ", "status": "todo"},
            {"title": "Examen blanc", "link_type": "pdf", "url": "https://example.com/exam.pdf", "status": "todo"},
        ]
        for i, s in enumerate(demos):
            uid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": uid, "email": s["email"].lower(), "name": s["name"], "role": "student",
                "password": hash_pw(s["password"]), "phone": s["phone"],
                "certificate": s["certificate"], "cohort": s["cohort"],
                "start_date": s["start_date"], "deadline": s["deadline"],
                "progress": 0, "status": "in_progress", "first_login": True, "welcome_seen": False,
                "note": "", "created_at": datetime.now(timezone.utc).isoformat(),
            })
            # advance 3rd student further and leave 2nd one late (no recent proof)
            tpl = [dict(c) for c in course_tpl]
            if i == 2:
                for c in tpl: c["status"] = "done"
            elif i == 1:
                for c in tpl[:1]: c["status"] = "done"
            elif i == 3:
                for c in tpl[:2]: c["status"] = "done"
                tpl[2]["status"] = "in_progress"
            for order, c in enumerate(tpl):
                await db.courses.insert_one({
                    "id": str(uuid.uuid4()), "user_id": uid, "order": order,
                    "created_at": datetime.now(timezone.utc).isoformat(), **c,
                })
            # Fake proof for first and third students (recent) so they're not late
            if i in (0, 2):
                await db.proofs.insert_one({
                    "id": str(uuid.uuid4()), "user_id": uid, "storage_path": "demo/no-upload.jpg",
                    "content_type": "image/jpeg", "comment": "Progression semaine 1",
                    "filename": "preuve.jpg",
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
                })
            # Old proof for 4th -> late
            if i == 3:
                await db.proofs.insert_one({
                    "id": str(uuid.uuid4()), "user_id": uid, "storage_path": "demo/no-upload.jpg",
                    "content_type": "image/jpeg", "comment": "Ancienne preuve",
                    "filename": "old.jpg",
                    "created_at": (datetime.now(timezone.utc) - timedelta(days=12)).isoformat(),
                })
            await recompute_user_stats(uid)
        log.info("Demo students seeded")

@app.on_event("startup")
async def _startup():
    await seed()

@app.on_event("shutdown")
async def _shutdown():
    client.close()

@api.get("/")
async def root():
    return {"ok": True, "name": "JZ KALYPHOR API"}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
