import asyncio
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.auth import create_access_token, decode_access_token_payload
from app.api.routes import router
from app.background import marketplace_cache_warmup_loop, seo_recheck_loop, wb_ads_bidder_loop, wb_ads_snapshot_sync_loop
from app.db import Base, engine, ensure_admin_emails, run_lightweight_migrations
from app.config import settings
from app.telemetry import record_api_timing

from datetime import datetime, timezone

app = FastAPI(title="SEO WIBE")
app.include_router(router)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")
STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.middleware("http")
async def apply_static_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        path = request.url.path.lower()
        ext = Path(path).suffix.lower()
        versioned = bool(request.query_params.get("v"))
        image_exts = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"}
        font_exts = {".woff", ".woff2", ".ttf", ".otf"}
        if path.startswith("/static/uploads/"):
            # Upload URLs are generated with unique names, so browser cache is safe and reduces flicker.
            cache_control = "public, max-age=900, stale-while-revalidate=60"
        elif versioned:
            cache_control = "public, max-age=604800, immutable"
        elif ext in image_exts or ext in font_exts:
            cache_control = "public, max-age=86400, must-revalidate"
        elif ext in {".js", ".css"}:
            cache_control = "public, max-age=900, must-revalidate"
        else:
            cache_control = "public, max-age=3600, must-revalidate"
        response.headers["Cache-Control"] = cache_control
        if "Pragma" in response.headers:
            del response.headers["Pragma"]
        if "Expires" in response.headers:
            del response.headers["Expires"]
    return response


@app.middleware("http")
async def refresh_access_token(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        return response
    auth_header = request.headers.get("authorization", "")
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        token = str(request.cookies.get("seo_wibe_token") or request.cookies.get("token") or "").strip()
    if not token:
        return response
    payload = decode_access_token_payload(token)
    if not payload or "sub" not in payload:
        return response
    exp = payload.get("exp")
    if not exp:
        return response
    exp_dt = None
    if isinstance(exp, (int, float)):
        exp_dt = datetime.fromtimestamp(float(exp), tz=timezone.utc)
    elif isinstance(exp, str):
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
        except Exception:
            exp_dt = None
    elif isinstance(exp, datetime):
        exp_dt = exp.astimezone(timezone.utc)
    if not exp_dt:
        return response
    now = datetime.now(timezone.utc)
    remaining_min = max(0, int((exp_dt - now).total_seconds() // 60))
    refresh_threshold = max(30, min(60 * 24, int(settings.token_expire_minutes // 2)))
    if remaining_min > refresh_threshold:
        return response
    new_token = create_access_token(str(payload.get("sub")))
    response.headers["x-auth-refresh"] = new_token
    return response


@app.middleware("http")
async def collect_api_metrics(request: Request, call_next):
    status_code = 500
    started = time.perf_counter()
    try:
        response = await call_next(request)
        status_code = int(response.status_code or 500)
        return response
    finally:
        if request.url.path.startswith("/api/"):
            route_obj = request.scope.get("route")
            route_path = getattr(route_obj, "path", request.url.path)
            duration_ms = (time.perf_counter() - started) * 1000.0
            record_api_timing(request.method, str(route_path or request.url.path), duration_ms)


@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)
    run_lightweight_migrations()
    ensure_admin_emails()
    asyncio.create_task(seo_recheck_loop())
    asyncio.create_task(wb_ads_snapshot_sync_loop())
    asyncio.create_task(wb_ads_bidder_loop())
    asyncio.create_task(marketplace_cache_warmup_loop())


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/mobile", response_class=HTMLResponse)
def mobile_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/admin", response_class=HTMLResponse)
def admin_page(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})


@app.get("/favicon.ico", include_in_schema=False)
def favicon_ico():
    return FileResponse(STATIC_DIR / "favicon.ico", media_type="image/x-icon")


@app.get("/favicon.svg", include_in_schema=False)
def favicon_svg():
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")


@app.get("/favicon-32x32.png", include_in_schema=False)
def favicon_32():
    return FileResponse(STATIC_DIR / "favicon-32x32.png", media_type="image/png")


@app.get("/apple-touch-icon.png", include_in_schema=False)
def apple_touch_icon():
    return FileResponse(STATIC_DIR / "apple-touch-icon.png", media_type="image/png")


@app.get("/site.webmanifest", include_in_schema=False)
def site_webmanifest():
    return FileResponse(STATIC_DIR / "site.webmanifest", media_type="application/manifest+json")
