from __future__ import annotations

import argparse
import json
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit


def normalize_photo_url(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        return f"https:{raw}"
    malformed_static = re.match(r"^https?://static/(.+)$", raw, flags=re.IGNORECASE)
    if malformed_static:
        return f"/static/{str(malformed_static.group(1) or '').lstrip('/')}"
    if raw.startswith(("http://", "https://", "/")):
        return raw
    if raw.startswith("static/"):
        return f"/{raw}"
    return f"https://{raw.lstrip('/')}"


def photo_identity_key(value: str | None) -> str:
    normalized = normalize_photo_url(value)
    if not normalized:
        return ""
    try:
        parsed = urlsplit(normalized)
    except Exception:
        return normalized.lower()
    path = str(parsed.path or "")
    path = re.sub(
        r"/(tm|small|preview|big|orig|x1|x2|c\d+x\d+|wc\d+(?:x\d+)?|w\d+h\d+|w\d+|h\d+|\d+x\d+)/",
        "/",
        path,
        flags=re.IGNORECASE,
    )
    path = re.sub(r"/+", "/", path).rstrip("/")
    return f"{parsed.netloc.lower()}{path.lower()}"


def photo_quality(value: str | None) -> int:
    low = str(value or "").lower()
    score = 0
    if "/orig/" in low or "/big/" in low:
        score += 6000
    best_dimension = 0
    for match in re.finditer(r"/(?:c|wc)(\d+)(?:x(\d+))?/", low):
        best_dimension = max(best_dimension, int(match.group(1) or 0), int(match.group(2) or 0))
    for match in re.finditer(r"/w(\d+)h(\d+)/", low):
        best_dimension = max(best_dimension, int(match.group(1) or 0), int(match.group(2) or 0))
    for match in re.finditer(r"/[wh](\d+)/", low):
        best_dimension = max(best_dimension, int(match.group(1) or 0))
    for match in re.finditer(r"/(\d+)x(\d+)/", low):
        best_dimension = max(best_dimension, int(match.group(1) or 0), int(match.group(2) or 0))
    score += min(best_dimension, 5000)
    if "/x2/" in low:
        score += 180
    if "/x1/" in low:
        score += 160
    if "/tm/" in low or "/small/" in low or "/preview/" in low:
        score += 80
    if "?" not in low:
        score += 5
    return score


def normalize_photo_list(values: object) -> list[str]:
    if isinstance(values, list):
        source = values
    elif values is None:
        source = []
    else:
        source = [values]
    order: list[str] = []
    chosen: dict[str, tuple[str, int]] = {}
    for item in source:
        normalized = normalize_photo_url(str(item or ""))
        if not normalized:
            continue
        key = photo_identity_key(normalized) or normalized.lower()
        score = photo_quality(normalized)
        prev = chosen.get(key)
        if prev is None:
            chosen[key] = (normalized, score)
            order.append(key)
        elif score > prev[1]:
            chosen[key] = (normalized, score)
    return [chosen[key][0] for key in order if key in chosen]


def photo_values(photos_json: str | None, photo_url: str | None) -> list[str]:
    out: list[str] = []
    raw_json = str(photos_json or "").strip()
    if raw_json:
        try:
            parsed = json.loads(raw_json)
        except Exception:
            parsed = []
        if isinstance(parsed, list):
            out.extend([str(x or "") for x in parsed])
        elif parsed:
            out.append(str(parsed))
    if photo_url:
        out.append(str(photo_url))
    return out


def cleanup(db_path: Path, *, dry_run: bool) -> tuple[int, int]:
    con = sqlite3.connect(str(db_path))
    try:
        con.row_factory = sqlite3.Row
        rows = con.execute(
            """
            SELECT id, photo_url, photos_json
            FROM products
            WHERE coalesce(photo_url, '') <> ''
               OR coalesce(photos_json, '') NOT IN ('', '[]')
            """
        ).fetchall()
        updates: list[tuple[str, str, int]] = []
        for row in rows:
            current_json = str(row["photos_json"] or "")
            has_photo_json = current_json.strip() not in {"", "[]"}
            cleaned = normalize_photo_list(photo_values(current_json if has_photo_json else "", row["photo_url"]))
            next_photo = cleaned[0] if cleaned else ""
            next_json = json.dumps(cleaned, ensure_ascii=False) if has_photo_json and cleaned else ("[]" if has_photo_json else current_json)
            if str(row["photo_url"] or "") != next_photo or current_json != next_json:
                updates.append((next_photo[:500], next_json, int(row["id"])))
        if updates and not dry_run:
            con.executemany("UPDATE products SET photo_url=?, photos_json=? WHERE id=?", updates)
            con.commit()
        return len(rows), len(updates)
    finally:
        con.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Deduplicate product photos in SEO WIBE SQLite database.")
    parser.add_argument("db", nargs="?", default="seo_wibe.db", help="Path to seo_wibe.db")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without updating the database")
    args = parser.parse_args()
    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")
    scanned, changed = cleanup(db_path, dry_run=bool(args.dry_run))
    action = "would update" if args.dry_run else "updated"
    print(f"Scanned {scanned} products, {action} {changed}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
