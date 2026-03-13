from __future__ import annotations

import copy
import random
from typing import Any

CHESS_GAME_CODE = "chess"

_CHESS_DIFF_LIST: list[dict[str, Any]] = [
    {
        "code": "easy",
        "title": "Easy",
        "subtitle": "Fast and forgiving bot",
        "depth": 1,
        "noise": 220.0,
        "bot_rating": 980,
    },
    {
        "code": "medium",
        "title": "Medium",
        "subtitle": "Balanced strategy",
        "depth": 2,
        "noise": 95.0,
        "bot_rating": 1220,
    },
    {
        "code": "hard",
        "title": "Hard",
        "subtitle": "Tactical and sharp",
        "depth": 3,
        "noise": 24.0,
        "bot_rating": 1460,
    },
    {
        "code": "expert",
        "title": "Expert",
        "subtitle": "Minimum mistakes",
        "depth": 3,
        "noise": 0.0,
        "bot_rating": 1650,
    },
]
_CHESS_DIFF_MAP: dict[str, dict[str, Any]] = {item["code"]: item for item in _CHESS_DIFF_LIST}

_EMPTY = ""
_FILES = "abcdefgh"
_ALLOWED_PIECES = {
    _EMPTY,
    "wP",
    "wN",
    "wB",
    "wR",
    "wQ",
    "wK",
    "bP",
    "bN",
    "bB",
    "bR",
    "bQ",
    "bK",
}
_PROMOTION_CHOICES = {"Q", "R", "B", "N"}
_PIECE_VALUES = {
    "P": 100,
    "N": 320,
    "B": 330,
    "R": 500,
    "Q": 900,
    "K": 20000,
}


def get_chess_difficulties() -> list[dict[str, Any]]:
    return [dict(item) for item in _CHESS_DIFF_LIST]


def get_chess_difficulty(code: str | None) -> dict[str, Any]:
    safe = str(code or "").strip().lower()
    return dict(_CHESS_DIFF_MAP.get(safe) or _CHESS_DIFF_MAP["medium"])


def build_chess_bot_identity(difficulty: str | None) -> dict[str, Any]:
    meta = get_chess_difficulty(difficulty)
    return {
        "actor_key": f"bot:chess:{meta['code']}",
        "nick": f"SEO WIBE AI · Chess {meta['title']}",
        "rating": int(meta.get("bot_rating") or 1200),
        "difficulty": meta["code"],
        "title": meta["title"],
        "subtitle": meta["subtitle"],
        "is_bot": True,
    }


def _inside(row: int, col: int) -> bool:
    return 0 <= int(row) < 8 and 0 <= int(col) < 8


def _piece_color(piece: str) -> str:
    value = str(piece or "")
    if len(value) == 2 and value[0] in {"w", "b"} and value[1] in _PIECE_VALUES:
        return "white" if value[0] == "w" else "black"
    return ""


def _piece_type(piece: str) -> str:
    value = str(piece or "")
    if len(value) == 2 and value[1] in _PIECE_VALUES:
        return value[1]
    return ""


def _enemy(side: str) -> str:
    return "black" if str(side) == "white" else "white"


def _clone_board(board: list[list[str]]) -> list[list[str]]:
    return [list(row) for row in board]


def _initial_board() -> list[list[str]]:
    return [
        ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
        ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
        [_EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY],
        [_EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY],
        [_EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY],
        [_EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY, _EMPTY],
        ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
        ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
    ]


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


def _normalize_history(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    out: list[dict[str, Any]] = []
    for item in value[-40:]:
        if not isinstance(item, dict):
            continue
        from_pos = _normalize_pos(item.get("from"))
        to_pos = _normalize_pos(item.get("to"))
        if not from_pos or not to_pos:
            continue
        out.append(
            {
                "side": str(item.get("side") or "") if str(item.get("side") or "") in {"white", "black"} else "",
                "from": from_pos,
                "to": to_pos,
                "piece": str(item.get("piece") or "")[:2],
                "capture": bool(item.get("capture")),
                "promotion": str(item.get("promotion") or "")[:1],
                "at": str(item.get("at") or "")[:40],
            }
        )
    return out


def create_chess_state() -> dict[str, Any]:
    return {
        "version": 1,
        "board": _initial_board(),
        "turn": "white",
        "winner": "",
        "result": "",
        "move_index": 0,
        "halfmove_clock": 0,
        "last_move": {},
        "history": [],
    }


def load_chess_state(raw: Any) -> dict[str, Any]:
    state = create_chess_state()
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
                safe_row.append(piece if piece in _ALLOWED_PIECES else _EMPTY)
            safe_board.append(safe_row)
        state["board"] = safe_board
    turn = str(raw.get("turn") or "white").strip().lower()
    state["turn"] = turn if turn in {"white", "black"} else "white"
    winner = str(raw.get("winner") or "").strip().lower()
    state["winner"] = winner if winner in {"white", "black"} else ""
    result = str(raw.get("result") or "").strip().lower()
    state["result"] = result if result in {"", "win", "draw", "resigned", "cancelled"} else ""
    state["move_index"] = max(0, int(raw.get("move_index") or 0))
    state["halfmove_clock"] = max(0, int(raw.get("halfmove_clock") or 0))
    last_move = raw.get("last_move") if isinstance(raw.get("last_move"), dict) else {}
    state["last_move"] = {
        "side": str(last_move.get("side") or "") if str(last_move.get("side") or "") in {"white", "black"} else "",
        "from": _normalize_pos(last_move.get("from")),
        "to": _normalize_pos(last_move.get("to")),
        "piece": str(last_move.get("piece") or "")[:2],
        "capture": bool(last_move.get("capture")),
        "promotion": str(last_move.get("promotion") or "")[:1],
        "at": str(last_move.get("at") or "")[:40],
    }
    state["history"] = _normalize_history(raw.get("history"))
    return state


def _iter_ray(board: list[list[str]], row: int, col: int, side: str, directions: list[tuple[int, int]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    piece = str(board[row][col] or "")
    for dr, dc in directions:
        r, c = row + dr, col + dc
        while _inside(r, c):
            target = str(board[r][c] or "")
            if not target:
                out.append(
                    {
                        "from": [row, col],
                        "to": [r, c],
                        "path": [[row, col], [r, c]],
                        "piece": piece,
                        "captures": [],
                        "capture_count": 0,
                        "promotes": False,
                    }
                )
                r += dr
                c += dc
                continue
            if _piece_color(target) != side:
                out.append(
                    {
                        "from": [row, col],
                        "to": [r, c],
                        "path": [[row, col], [r, c]],
                        "piece": piece,
                        "captures": [[r, c]],
                        "capture_count": 1,
                        "promotes": False,
                    }
                )
            break
    return out


def _piece_moves(board: list[list[str]], row: int, col: int, side: str) -> list[dict[str, Any]]:
    piece = str(board[row][col] or "")
    ptype = _piece_type(piece)
    if not ptype:
        return []
    out: list[dict[str, Any]] = []
    if ptype == "P":
        forward = -1 if side == "white" else 1
        start_row = 6 if side == "white" else 1
        one_row = row + forward
        if _inside(one_row, col) and not str(board[one_row][col] or ""):
            out.append(
                {
                    "from": [row, col],
                    "to": [one_row, col],
                    "path": [[row, col], [one_row, col]],
                    "piece": piece,
                    "captures": [],
                    "capture_count": 0,
                    "promotes": bool((side == "white" and one_row == 0) or (side == "black" and one_row == 7)),
                }
            )
            two_row = row + (2 * forward)
            if row == start_row and _inside(two_row, col) and not str(board[two_row][col] or ""):
                out.append(
                    {
                        "from": [row, col],
                        "to": [two_row, col],
                        "path": [[row, col], [two_row, col]],
                        "piece": piece,
                        "captures": [],
                        "capture_count": 0,
                        "promotes": False,
                    }
                )
        for dc in (-1, 1):
            tr, tc = row + forward, col + dc
            if not _inside(tr, tc):
                continue
            target = str(board[tr][tc] or "")
            if target and _piece_color(target) != side:
                out.append(
                    {
                        "from": [row, col],
                        "to": [tr, tc],
                        "path": [[row, col], [tr, tc]],
                        "piece": piece,
                        "captures": [[tr, tc]],
                        "capture_count": 1,
                        "promotes": bool((side == "white" and tr == 0) or (side == "black" and tr == 7)),
                    }
                )
        return out
    if ptype == "N":
        steps = [(-2, -1), (-2, 1), (-1, -2), (-1, 2), (1, -2), (1, 2), (2, -1), (2, 1)]
        for dr, dc in steps:
            tr, tc = row + dr, col + dc
            if not _inside(tr, tc):
                continue
            target = str(board[tr][tc] or "")
            if target and _piece_color(target) == side:
                continue
            cap = [[tr, tc]] if target else []
            out.append(
                {
                    "from": [row, col],
                    "to": [tr, tc],
                    "path": [[row, col], [tr, tc]],
                    "piece": piece,
                    "captures": cap,
                    "capture_count": len(cap),
                    "promotes": False,
                }
            )
        return out
    if ptype == "B":
        return _iter_ray(board, row, col, side, [(-1, -1), (-1, 1), (1, -1), (1, 1)])
    if ptype == "R":
        return _iter_ray(board, row, col, side, [(-1, 0), (1, 0), (0, -1), (0, 1)])
    if ptype == "Q":
        return _iter_ray(
            board,
            row,
            col,
            side,
            [(-1, -1), (-1, 1), (1, -1), (1, 1), (-1, 0), (1, 0), (0, -1), (0, 1)],
        )
    if ptype == "K":
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                tr, tc = row + dr, col + dc
                if not _inside(tr, tc):
                    continue
                target = str(board[tr][tc] or "")
                if target and _piece_color(target) == side:
                    continue
                cap = [[tr, tc]] if target else []
                out.append(
                    {
                        "from": [row, col],
                        "to": [tr, tc],
                        "path": [[row, col], [tr, tc]],
                        "piece": piece,
                        "captures": cap,
                        "capture_count": len(cap),
                        "promotes": False,
                    }
                )
    return out


def get_chess_legal_moves(state: dict[str, Any], side: str | None = None) -> list[dict[str, Any]]:
    safe = load_chess_state(state)
    if safe.get("winner") or safe.get("result") in {"draw", "cancelled"}:
        return []
    current_side = str(side or safe.get("turn") or "white").strip().lower()
    if current_side not in {"white", "black"}:
        return []
    board = safe["board"]
    moves: list[dict[str, Any]] = []
    for row in range(8):
        for col in range(8):
            piece = str(board[row][col] or "")
            if _piece_color(piece) != current_side:
                continue
            moves.extend(_piece_moves(board, row, col, current_side))
    moves.sort(
        key=lambda item: (
            -int(item.get("capture_count") or 0),
            item["from"][0],
            item["from"][1],
            item["to"][0],
            item["to"][1],
        )
    )
    return moves


def _king_exists(board: list[list[str]], side: str) -> bool:
    king = "wK" if side == "white" else "bK"
    for row in board:
        for cell in row:
            if str(cell or "") == king:
                return True
    return False


def _normalize_move_payload(value: Any) -> tuple[list[int], list[int], str]:
    if isinstance(value, dict):
        from_pos = _normalize_pos(value.get("from"))
        to_pos = _normalize_pos(value.get("to"))
        promotion = str(value.get("promotion") or "").strip().upper()[:1]
        if not promotion or promotion not in _PROMOTION_CHOICES:
            promotion = "Q"
        if from_pos and to_pos:
            return from_pos, to_pos, promotion
        path = value.get("path")
        if isinstance(path, list) and len(path) >= 2:
            p0 = _normalize_pos(path[0])
            p1 = _normalize_pos(path[-1])
            if p0 and p1:
                return p0, p1, promotion
    if isinstance(value, list) and len(value) >= 2:
        p0 = _normalize_pos(value[0])
        p1 = _normalize_pos(value[-1])
        if p0 and p1:
            return p0, p1, "Q"
    raise ValueError("Invalid move payload")


def apply_chess_move(state: dict[str, Any], payload: Any) -> dict[str, Any]:
    safe = load_chess_state(copy.deepcopy(state))
    from_pos, to_pos, promotion = _normalize_move_payload(payload)
    side = str(safe.get("turn") or "white")
    moves = get_chess_legal_moves(safe, side)
    chosen = None
    for move in moves:
        if move["from"] == from_pos and move["to"] == to_pos:
            chosen = move
            break
    if not chosen:
        raise ValueError("Move is not legal")
    board = _clone_board(safe["board"])
    fr, fc = chosen["from"]
    tr, tc = chosen["to"]
    piece = str(board[fr][fc] or "")
    if _piece_color(piece) != side:
        raise ValueError("Selected piece is missing")
    target = str(board[tr][tc] or "")
    capture = bool(target)
    board[fr][fc] = _EMPTY
    promoted = ""
    if bool(chosen.get("promotes")) and _piece_type(piece) == "P":
        promoted = promotion if promotion in _PROMOTION_CHOICES else "Q"
        piece = ("w" if side == "white" else "b") + promoted
    board[tr][tc] = piece
    safe["board"] = board
    safe["move_index"] = max(0, int(safe.get("move_index") or 0)) + 1
    moved_pawn = _piece_type(str(chosen.get("piece") or "")) == "P"
    safe["halfmove_clock"] = 0 if (capture or moved_pawn) else (max(0, int(safe.get("halfmove_clock") or 0)) + 1)
    move_info = {
        "side": side,
        "from": from_pos,
        "to": to_pos,
        "piece": str(chosen.get("piece") or "")[:2],
        "capture": capture,
        "promotion": promoted,
        "at": "",
    }
    safe["last_move"] = move_info
    history = _normalize_history(safe.get("history"))
    history.append(move_info)
    safe["history"] = history[-40:]
    other = _enemy(side)
    if not _king_exists(board, other):
        safe["winner"] = side
        safe["result"] = "win"
        return safe
    safe["turn"] = other
    if not get_chess_legal_moves(safe, other):
        safe["winner"] = side
        safe["result"] = "win"
        return safe
    if int(safe.get("halfmove_clock") or 0) >= 120:
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
        return 200000 if winner == perspective else -200000
    board = state["board"]
    score = 0
    for row in range(8):
        for col in range(8):
            piece = str(board[row][col] or "")
            color = _piece_color(piece)
            if not color:
                continue
            ptype = _piece_type(piece)
            base = int(_PIECE_VALUES.get(ptype, 0))
            center = 14 if row in {2, 3, 4, 5} and col in {2, 3, 4, 5} else 0
            sign = 1 if color == perspective else -1
            score += sign * (base + center)
    mobility = len(get_chess_legal_moves(state, perspective)) - len(get_chess_legal_moves(state, _enemy(perspective)))
    score += mobility * 2
    return int(score)


def _minimax(state: dict[str, Any], depth: int, alpha: float, beta: float, maximizing_side: str) -> float:
    safe = load_chess_state(state)
    winner = str(safe.get("winner") or "")
    result = str(safe.get("result") or "")
    if depth <= 0 or winner or result == "draw":
        return float(_evaluate_state(safe, maximizing_side))
    current_side = str(safe.get("turn") or "white")
    moves = get_chess_legal_moves(safe, current_side)
    if not moves:
        return 150000.0 if current_side != maximizing_side else -150000.0
    maximizing = current_side == maximizing_side
    if maximizing:
        value = float("-inf")
        for move in moves:
            child = apply_chess_move(safe, move)
            value = max(value, _minimax(child, depth - 1, alpha, beta, maximizing_side))
            alpha = max(alpha, value)
            if beta <= alpha:
                break
        return value
    value = float("inf")
    for move in moves:
        child = apply_chess_move(safe, move)
        value = min(value, _minimax(child, depth - 1, alpha, beta, maximizing_side))
        beta = min(beta, value)
        if beta <= alpha:
            break
    return value


def pick_chess_bot_move(state: dict[str, Any], difficulty: str | None = None) -> dict[str, Any] | None:
    safe = load_chess_state(state)
    if safe.get("winner") or safe.get("result") == "draw":
        return None
    side = str(safe.get("turn") or "black")
    moves = get_chess_legal_moves(safe, side)
    if not moves:
        return None
    if len(moves) == 1:
        return dict(moves[0])
    meta = get_chess_difficulty(difficulty)
    depth = max(1, int(meta.get("depth") or 2))
    scored: list[tuple[float, dict[str, Any]]] = []
    for move in moves:
        child = apply_chess_move(safe, move)
        value = _minimax(child, depth - 1, float("-inf"), float("inf"), side)
        noise = float(meta.get("noise") or 0.0)
        if noise > 0:
            value += random.uniform(-noise, noise)
        scored.append((value, move))
    scored.sort(key=lambda item: item[0], reverse=True)
    top_window = 1
    code = str(meta.get("code") or "medium")
    if code == "easy":
        top_window = min(5, len(scored))
    elif code == "medium":
        top_window = min(3, len(scored))
    elif code == "hard":
        top_window = min(2, len(scored))
    chosen = dict(random.choice(scored[:top_window])[1])
    if bool(chosen.get("promotes")) and not str(chosen.get("promotion") or ""):
        chosen["promotion"] = "Q"
    return chosen


def format_chess_coord(pos: list[int] | tuple[int, int] | None) -> str:
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
