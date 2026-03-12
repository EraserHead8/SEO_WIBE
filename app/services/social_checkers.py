from __future__ import annotations

import copy
import random
import secrets
import string
from typing import Any

CHECKERS_GAME_CODE = "checkers"

_CHECKERS_DIFF_LIST: list[dict[str, Any]] = [
    {
        "code": "easy",
        "title": "Легкий",
        "subtitle": "Спокойный соперник для первого матча",
        "depth": 1,
        "noise": 28.0,
        "bot_rating": 980,
    },
    {
        "code": "medium",
        "title": "Средний",
        "subtitle": "Сбалансированная игра без лишней жесткости",
        "depth": 2,
        "noise": 12.0,
        "bot_rating": 1200,
    },
    {
        "code": "hard",
        "title": "Сложный",
        "subtitle": "Активно ищет связки и размены",
        "depth": 3,
        "noise": 4.0,
        "bot_rating": 1380,
    },
    {
        "code": "expert",
        "title": "Эксперт",
        "subtitle": "Максимально точная игра для рейтинговых сессий",
        "depth": 4,
        "noise": 0.0,
        "bot_rating": 1560,
    },
]
_CHECKERS_DIFF_MAP: dict[str, dict[str, Any]] = {item["code"]: item for item in _CHECKERS_DIFF_LIST}
_EMPTY = ""
_FILES = "abcdefgh"


def get_checkers_difficulties() -> list[dict[str, Any]]:
    return [dict(item) for item in _CHECKERS_DIFF_LIST]


def get_checkers_difficulty(code: str | None) -> dict[str, Any]:
    safe = str(code or "").strip().lower()
    return dict(_CHECKERS_DIFF_MAP.get(safe) or _CHECKERS_DIFF_MAP["medium"])


def build_checkers_bot_identity(difficulty: str | None) -> dict[str, Any]:
    meta = get_checkers_difficulty(difficulty)
    return {
        "actor_key": f"bot:{meta['code']}",
        "nick": f"SEO WIBE AI · {meta['title']}",
        "rating": int(meta.get("bot_rating") or 1200),
        "difficulty": meta["code"],
        "title": meta["title"],
        "subtitle": meta["subtitle"],
        "is_bot": True,
    }


def create_checkers_room_code(existing_codes: set[str] | None = None) -> str:
    used = {str(x or "").strip().upper() for x in (existing_codes or set()) if str(x or "").strip()}
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(48):
        code = "".join(secrets.choice(alphabet) for _ in range(6))
        if code not in used:
            return code
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(8))


def _inside(row: int, col: int) -> bool:
    return 0 <= int(row) < 8 and 0 <= int(col) < 8


def _dark_square(row: int, col: int) -> bool:
    return ((int(row) + int(col)) % 2) == 1


def _piece_color(piece: str) -> str:
    value = str(piece or "")
    if value in {"w", "W"}:
        return "white"
    if value in {"b", "B"}:
        return "black"
    return ""


def _is_king(piece: str) -> bool:
    return str(piece or "") in {"W", "B"}


def _clone_board(board: list[list[str]]) -> list[list[str]]:
    return [list(row) for row in board]


def _initial_board() -> list[list[str]]:
    board = [[_EMPTY for _ in range(8)] for _ in range(8)]
    for row in range(3):
        for col in range(8):
            if _dark_square(row, col):
                board[row][col] = "b"
    for row in range(5, 8):
        for col in range(8):
            if _dark_square(row, col):
                board[row][col] = "w"
    return board


def _normalize_pos(value: Any) -> list[int] | None:
    if not isinstance(value, (list, tuple)) or len(value) != 2:
        return None
    try:
        row = int(value[0])
        col = int(value[1])
    except Exception:
        return None
    if not _inside(row, col):
        return None
    return [row, col]


def _normalize_path(value: Any) -> list[list[int]]:
    if not isinstance(value, list):
        return []
    out: list[list[int]] = []
    for item in value:
        pos = _normalize_pos(item)
        if not pos:
            return []
        out.append(pos)
    return out if len(out) >= 2 else []


def _sanitize_history(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, Any]] = []
    for item in value[-20:]:
        if not isinstance(item, dict):
            continue
        path = _normalize_path(item.get("path"))
        if not path:
            continue
        out.append(
            {
                "side": str(item.get("side") or "") if str(item.get("side") or "") in {"white", "black"} else "",
                "path": path,
                "capture_count": max(0, int(item.get("capture_count") or 0)),
                "promoted": bool(item.get("promoted")),
                "at": str(item.get("at") or "")[:40],
            }
        )
    return out


def create_checkers_state() -> dict[str, Any]:
    return {
        "version": 1,
        "board": _initial_board(),
        "turn": "white",
        "winner": "",
        "result": "",
        "move_index": 0,
        "without_capture_turns": 0,
        "last_move": {},
        "history": [],
    }


def load_checkers_state(raw: Any) -> dict[str, Any]:
    state = create_checkers_state()
    if not isinstance(raw, dict):
        return state
    board = raw.get("board")
    valid_board = isinstance(board, list) and len(board) == 8 and all(isinstance(row, list) and len(row) == 8 for row in board)
    if valid_board:
        safe_board: list[list[str]] = []
        for row in board:
            safe_row: list[str] = []
            for cell in row:
                piece = str(cell or "")
                safe_row.append(piece if piece in {"w", "W", "b", "B"} else _EMPTY)
            safe_board.append(safe_row)
        state["board"] = safe_board
    turn = str(raw.get("turn") or "white").strip().lower()
    state["turn"] = turn if turn in {"white", "black"} else "white"
    winner = str(raw.get("winner") or "").strip().lower()
    state["winner"] = winner if winner in {"white", "black"} else ""
    result = str(raw.get("result") or "").strip().lower()
    state["result"] = result if result in {"", "win", "draw", "resigned", "cancelled"} else ""
    state["move_index"] = max(0, int(raw.get("move_index") or 0))
    state["without_capture_turns"] = max(0, int(raw.get("without_capture_turns") or 0))
    last_move = raw.get("last_move") if isinstance(raw.get("last_move"), dict) else {}
    state["last_move"] = {
        "side": str(last_move.get("side") or "") if str(last_move.get("side") or "") in {"white", "black"} else "",
        "path": _normalize_path(last_move.get("path")),
        "capture_count": max(0, int(last_move.get("capture_count") or 0)),
        "promoted": bool(last_move.get("promoted")),
        "at": str(last_move.get("at") or "")[:40],
    }
    state["history"] = _sanitize_history(raw.get("history"))
    return state


def _move_dirs(piece: str) -> list[tuple[int, int]]:
    if piece == "w":
        return [(-1, -1), (-1, 1)]
    if piece == "b":
        return [(1, -1), (1, 1)]
    if piece in {"W", "B"}:
        return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    return []


def _capture_dirs(piece: str) -> list[tuple[int, int]]:
    if piece in {"W", "B"}:
        return [(-1, -1), (-1, 1), (1, -1), (1, 1)]
    return [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def _capture_paths(board: list[list[str]], row: int, col: int, piece: str) -> list[tuple[list[list[int]], list[list[int]]]]:
    color = _piece_color(piece)
    if not color:
        return []
    found: list[tuple[list[list[int]], list[list[int]]]] = []
    for dr, dc in _capture_dirs(piece):
        mid_row, mid_col = row + dr, col + dc
        target_row, target_col = row + (2 * dr), col + (2 * dc)
        if not (_inside(mid_row, mid_col) and _inside(target_row, target_col)):
            continue
        mid_piece = str(board[mid_row][mid_col] or "")
        if not mid_piece or _piece_color(mid_piece) in {"", color}:
            continue
        if str(board[target_row][target_col] or ""):
            continue
        next_board = _clone_board(board)
        next_board[row][col] = _EMPTY
        next_board[mid_row][mid_col] = _EMPTY
        next_board[target_row][target_col] = piece
        tails = _capture_paths(next_board, target_row, target_col, piece)
        if tails:
            for tail_path, tail_caps in tails:
                found.append(([[row, col]] + tail_path, [[mid_row, mid_col]] + tail_caps))
        else:
            found.append(([[row, col], [target_row, target_col]], [[mid_row, mid_col]]))
    return found


def _quiet_moves(board: list[list[str]], row: int, col: int, piece: str) -> list[dict[str, Any]]:
    moves: list[dict[str, Any]] = []
    for dr, dc in _move_dirs(piece):
        target_row, target_col = row + dr, col + dc
        if not _inside(target_row, target_col):
            continue
        if str(board[target_row][target_col] or ""):
            continue
        moves.append(
            {
                "from": [row, col],
                "to": [target_row, target_col],
                "path": [[row, col], [target_row, target_col]],
                "captures": [],
                "capture_count": 0,
                "piece": piece,
                "is_capture": False,
                "promotes": bool(piece == "w" and target_row == 0) or bool(piece == "b" and target_row == 7),
            }
        )
    return moves


def get_checkers_legal_moves(state: dict[str, Any], side: str | None = None) -> list[dict[str, Any]]:
    safe = load_checkers_state(state)
    if safe.get("winner") or safe.get("result") in {"draw", "cancelled"}:
        return []
    current_side = str(side or safe.get("turn") or "white").strip().lower()
    if current_side not in {"white", "black"}:
        return []
    board = safe["board"]
    captures: list[dict[str, Any]] = []
    quiets: list[dict[str, Any]] = []
    for row in range(8):
        for col in range(8):
            piece = str(board[row][col] or "")
            if _piece_color(piece) != current_side:
                continue
            for path, captured in _capture_paths(board, row, col, piece):
                final_row, final_col = path[-1]
                captures.append(
                    {
                        "from": [row, col],
                        "to": [final_row, final_col],
                        "path": path,
                        "captures": captured,
                        "capture_count": len(captured),
                        "piece": piece,
                        "is_capture": True,
                        "promotes": bool(piece == "w" and final_row == 0) or bool(piece == "b" and final_row == 7),
                    }
                )
            quiets.extend(_quiet_moves(board, row, col, piece))
    if captures:
        captures.sort(key=lambda item: (-int(item.get("capture_count") or 0), item["from"][0], item["from"][1], item["to"][0], item["to"][1]))
        return captures
    quiets.sort(key=lambda item: (item["from"][0], item["from"][1], item["to"][0], item["to"][1]))
    return quiets


def _path_key(path: list[list[int]]) -> str:
    return "|".join(f"{int(pos[0])}:{int(pos[1])}" for pos in path)


def _count_material(board: list[list[str]]) -> tuple[int, int]:
    white = 0
    black = 0
    for row in board:
        for piece in row:
            color = _piece_color(piece)
            if color == "white":
                white += 2 if _is_king(piece) else 1
            elif color == "black":
                black += 2 if _is_king(piece) else 1
    return white, black


def _winner_from_state(state: dict[str, Any]) -> str:
    board = state["board"]
    white_material, black_material = _count_material(board)
    if white_material <= 0:
        return "black"
    if black_material <= 0:
        return "white"
    turn = str(state.get("turn") or "white")
    if not get_checkers_legal_moves(state, turn):
        return "black" if turn == "white" else "white"
    return ""


def apply_checkers_move(state: dict[str, Any], path: Any) -> dict[str, Any]:
    safe = load_checkers_state(copy.deepcopy(state))
    submitted_path = _normalize_path(path)
    if not submitted_path:
        raise ValueError("Некорректный ход")
    side = str(safe.get("turn") or "white")
    moves = get_checkers_legal_moves(safe, side)
    expected = {_path_key(item["path"]): item for item in moves}
    chosen = expected.get(_path_key(submitted_path))
    if not chosen:
        raise ValueError("Ход не входит в список допустимых")
    board = _clone_board(safe["board"])
    start_row, start_col = chosen["from"]
    piece = str(board[start_row][start_col] or "")
    if _piece_color(piece) != side:
        raise ValueError("Не удалось найти выбранную шашку")
    board[start_row][start_col] = _EMPTY
    current_row, current_col = start_row, start_col
    captured_any = False
    for next_row, next_col in chosen["path"][1:]:
        if abs(int(next_row) - int(current_row)) == 2 and abs(int(next_col) - int(current_col)) == 2:
            mid_row = (int(next_row) + int(current_row)) // 2
            mid_col = (int(next_col) + int(current_col)) // 2
            board[mid_row][mid_col] = _EMPTY
            captured_any = True
        current_row, current_col = int(next_row), int(next_col)
    promoted = False
    if piece == "w" and current_row == 0:
        piece = "W"
        promoted = True
    elif piece == "b" and current_row == 7:
        piece = "B"
        promoted = True
    board[current_row][current_col] = piece
    safe["board"] = board
    safe["move_index"] = max(0, int(safe.get("move_index") or 0)) + 1
    safe["without_capture_turns"] = 0 if (captured_any or promoted) else max(0, int(safe.get("without_capture_turns") or 0)) + 1
    safe["last_move"] = {
        "side": side,
        "path": chosen["path"],
        "capture_count": int(chosen.get("capture_count") or 0),
        "promoted": bool(promoted),
        "at": "",
    }
    history = _sanitize_history(safe.get("history"))
    history.append(
        {
            "side": side,
            "path": chosen["path"],
            "capture_count": int(chosen.get("capture_count") or 0),
            "promoted": bool(promoted),
            "at": "",
        }
    )
    safe["history"] = history[-20:]
    safe["turn"] = "black" if side == "white" else "white"
    winner = _winner_from_state(safe)
    if winner:
        safe["winner"] = winner
        safe["result"] = "win"
        return safe
    if int(safe.get("without_capture_turns") or 0) >= 80:
        safe["winner"] = ""
        safe["result"] = "draw"
        return safe
    safe["winner"] = ""
    safe["result"] = ""
    return safe


def _evaluate_state(state: dict[str, Any], perspective: str) -> int:
    winner = str(state.get("winner") or "")
    result = str(state.get("result") or "")
    if result == "draw":
        return 0
    if winner:
        return 100000 if winner == perspective else -100000
    board = state["board"]
    score = 0
    for row in range(8):
        for col in range(8):
            piece = str(board[row][col] or "")
            color = _piece_color(piece)
            if not color:
                continue
            sign = 1 if color == perspective else -1
            if _is_king(piece):
                value = 190
            else:
                progress = (7 - row) if color == "white" else row
                value = 108 + (progress * 6)
            center_bonus = 10 if row in {2, 3, 4, 5} and col in {2, 3, 4, 5} else 0
            score += sign * (value + center_bonus)
    white_moves = len(get_checkers_legal_moves(state, "white"))
    black_moves = len(get_checkers_legal_moves(state, "black"))
    mobility = white_moves - black_moves
    score += mobility * (4 if perspective == "white" else -4)
    return int(score)


def _minimax(state: dict[str, Any], depth: int, alpha: float, beta: float, maximizing_side: str) -> float:
    safe = load_checkers_state(state)
    winner = str(safe.get("winner") or "")
    result = str(safe.get("result") or "")
    if depth <= 0 or winner or result == "draw":
        return float(_evaluate_state(safe, maximizing_side))
    current_side = str(safe.get("turn") or "white")
    moves = get_checkers_legal_moves(safe, current_side)
    if not moves:
        return 100000.0 if current_side != maximizing_side else -100000.0
    maximizing = current_side == maximizing_side
    if maximizing:
        value = float('-inf')
        for move in moves:
            child = apply_checkers_move(safe, move["path"])
            value = max(value, _minimax(child, depth - 1, alpha, beta, maximizing_side))
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return value
    value = float('inf')
    for move in moves:
        child = apply_checkers_move(safe, move["path"])
        value = min(value, _minimax(child, depth - 1, alpha, beta, maximizing_side))
        beta = min(beta, value)
        if beta <= alpha:
            break
    return value


def pick_checkers_bot_move(state: dict[str, Any], difficulty: str | None = None) -> dict[str, Any] | None:
    safe = load_checkers_state(state)
    if safe.get("winner") or safe.get("result") == "draw":
        return None
    side = str(safe.get("turn") or "black")
    meta = get_checkers_difficulty(difficulty)
    moves = get_checkers_legal_moves(safe, side)
    if not moves:
        return None
    if len(moves) == 1:
        return dict(moves[0])
    scored: list[tuple[float, dict[str, Any]]] = []
    depth = max(1, int(meta.get("depth") or 2))
    for move in moves:
        child = apply_checkers_move(safe, move["path"])
        score = _minimax(child, depth - 1, float('-inf'), float('inf'), side)
        noise = float(meta.get("noise") or 0.0)
        if noise > 0:
            score += random.uniform(-noise, noise)
        scored.append((score, move))
    scored.sort(key=lambda item: item[0], reverse=True)
    top_window = 1
    if str(meta.get("code") or "") == "easy":
        top_window = min(3, len(scored))
    elif str(meta.get("code") or "") == "medium":
        top_window = min(2, len(scored))
    return dict(random.choice(scored[:top_window])[1])


def apply_checkers_elo(rating: int, opponent_rating: int, score: float, k: int = 26) -> tuple[int, int]:
    safe_rating = max(100, int(rating or 1200))
    safe_opp = max(100, int(opponent_rating or 1200))
    expected = 1.0 / (1.0 + (10.0 ** ((safe_opp - safe_rating) / 400.0)))
    next_rating = int(round(safe_rating + (int(k or 26) * (float(score) - expected))))
    next_rating = max(100, next_rating)
    return next_rating, int(next_rating - safe_rating)


def format_checkers_coord(pos: list[int] | tuple[int, int] | None) -> str:
    if not isinstance(pos, (list, tuple)) or len(pos) != 2:
        return ""
    try:
        row = int(pos[0])
        col = int(pos[1])
    except Exception:
        return ""
    if not _inside(row, col):
        return ""
    return f"{_FILES[col]}{8 - row}"
