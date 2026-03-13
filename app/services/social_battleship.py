from __future__ import annotations

import copy
import random
from typing import Any

BATTLESHIP_GAME_CODE = "battleship"
BOARD_SIZE = 10
SHIP_SIZES = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]

_BATTLESHIP_DIFF_LIST: list[dict[str, Any]] = [
    {
        "code": "easy",
        "title": "Easy",
        "subtitle": "Random fire with occasional misses",
        "bot_rating": 980,
    },
    {
        "code": "medium",
        "title": "Medium",
        "subtitle": "Looks around successful hits",
        "bot_rating": 1200,
    },
    {
        "code": "hard",
        "title": "Hard",
        "subtitle": "Uses parity and targeted finish",
        "bot_rating": 1420,
    },
    {
        "code": "expert",
        "title": "Expert",
        "subtitle": "Maximum pressure on clusters",
        "bot_rating": 1600,
    },
]
_BATTLESHIP_DIFF_MAP: dict[str, dict[str, Any]] = {item["code"]: item for item in _BATTLESHIP_DIFF_LIST}


def get_battleship_difficulties() -> list[dict[str, Any]]:
    return [dict(item) for item in _BATTLESHIP_DIFF_LIST]


def get_battleship_difficulty(code: str | None) -> dict[str, Any]:
    safe = str(code or "").strip().lower()
    return dict(_BATTLESHIP_DIFF_MAP.get(safe) or _BATTLESHIP_DIFF_MAP["medium"])


def build_battleship_bot_identity(difficulty: str | None) -> dict[str, Any]:
    meta = get_battleship_difficulty(difficulty)
    return {
        "actor_key": f"bot:battleship:{meta['code']}",
        "nick": f"SEO WIBE AI · Fleet {meta['title']}",
        "rating": int(meta.get("bot_rating") or 1200),
        "difficulty": meta["code"],
        "title": meta["title"],
        "subtitle": meta["subtitle"],
        "is_bot": True,
    }


def _inside(row: int, col: int) -> bool:
    return 0 <= int(row) < BOARD_SIZE and 0 <= int(col) < BOARD_SIZE


def _empty_board() -> list[list[str]]:
    return [["" for _ in range(BOARD_SIZE)] for _ in range(BOARD_SIZE)]


def _clone_board(board: list[list[str]]) -> list[list[str]]:
    return [list(row) for row in board]


def _neighbors(row: int, col: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            rr, cc = row + dr, col + dc
            if _inside(rr, cc):
                out.append((rr, cc))
    return out


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


def _place_random_fleet() -> tuple[list[list[str]], list[dict[str, Any]]]:
    board = _empty_board()
    ships: list[dict[str, Any]] = []
    ship_idx = 1
    for size in SHIP_SIZES:
        placed = False
        for _ in range(1800):
            horizontal = bool(random.randint(0, 1))
            if horizontal:
                row = random.randint(0, BOARD_SIZE - 1)
                col = random.randint(0, BOARD_SIZE - size)
                cells = [[row, col + offset] for offset in range(size)]
            else:
                row = random.randint(0, BOARD_SIZE - size)
                col = random.randint(0, BOARD_SIZE - 1)
                cells = [[row + offset, col] for offset in range(size)]
            ok = True
            for rr, cc in cells:
                if board[rr][cc] == "S":
                    ok = False
                    break
                for nr, nc in _neighbors(rr, cc):
                    if board[nr][nc] == "S":
                        ok = False
                        break
                if not ok:
                    break
            if not ok:
                continue
            for rr, cc in cells:
                board[rr][cc] = "S"
            ships.append(
                {
                    "id": f"ship{ship_idx}",
                    "size": int(size),
                    "cells": cells,
                }
            )
            ship_idx += 1
            placed = True
            break
        if not placed:
            # restart in rare edge cases
            return _place_random_fleet()
    return board, ships


def create_battleship_player_state() -> dict[str, Any]:
    board, ships = _place_random_fleet()
    return {
        "board": board,
        "ships": ships,
        "ready": True,
    }


def create_battleship_state(*, include_black: bool = False) -> dict[str, Any]:
    return {
        "version": 1,
        "turn": "white",
        "winner": "",
        "result": "",
        "move_index": 0,
        "last_move": {},
        "history": [],
        "players": {
            "white": create_battleship_player_state(),
            "black": create_battleship_player_state() if include_black else {"board": _empty_board(), "ships": [], "ready": False},
        },
    }


def _normalize_ship(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    cells_raw = item.get("cells")
    if not isinstance(cells_raw, list):
        return None
    cells: list[list[int]] = []
    seen: set[tuple[int, int]] = set()
    for cell in cells_raw:
        pos = _normalize_pos(cell)
        if not pos:
            return None
        key = (pos[0], pos[1])
        if key in seen:
            return None
        seen.add(key)
        cells.append(pos)
    if not cells:
        return None
    return {
        "id": str(item.get("id") or "ship")[:24],
        "size": max(1, int(item.get("size") or len(cells))),
        "cells": cells,
    }


def load_battleship_state(raw: Any) -> dict[str, Any]:
    state = create_battleship_state(include_black=False)
    if not isinstance(raw, dict):
        return state
    turn = str(raw.get("turn") or "white").strip().lower()
    state["turn"] = turn if turn in {"white", "black"} else "white"
    winner = str(raw.get("winner") or "").strip().lower()
    state["winner"] = winner if winner in {"white", "black"} else ""
    result = str(raw.get("result") or "").strip().lower()
    state["result"] = result if result in {"", "win", "draw", "resigned", "cancelled"} else ""
    state["move_index"] = max(0, int(raw.get("move_index") or 0))
    players_raw = raw.get("players") if isinstance(raw.get("players"), dict) else {}
    clean_players: dict[str, dict[str, Any]] = {}
    for side in ("white", "black"):
        src = players_raw.get(side) if isinstance(players_raw.get(side), dict) else {}
        board = src.get("board")
        if not (isinstance(board, list) and len(board) == BOARD_SIZE and all(isinstance(row, list) and len(row) == BOARD_SIZE for row in board)):
            board = _empty_board()
        clean_board: list[list[str]] = []
        for row in board:
            clean_row: list[str] = []
            for cell in row:
                safe = str(cell or "")
                clean_row.append(safe if safe in {"", "S", "H", "M"} else "")
            clean_board.append(clean_row)
        ships_src = src.get("ships") if isinstance(src.get("ships"), list) else []
        ships = []
        for item in ships_src:
            ship = _normalize_ship(item)
            if ship:
                ships.append(ship)
        clean_players[side] = {
            "board": clean_board,
            "ships": ships,
            "ready": bool(src.get("ready")),
        }
    state["players"] = clean_players
    last_move = raw.get("last_move") if isinstance(raw.get("last_move"), dict) else {}
    state["last_move"] = {
        "side": str(last_move.get("side") or "") if str(last_move.get("side") or "") in {"white", "black"} else "",
        "target": _normalize_pos(last_move.get("target")),
        "hit": bool(last_move.get("hit")),
        "sunk": bool(last_move.get("sunk")),
        "at": str(last_move.get("at") or "")[:40],
    }
    history_raw = raw.get("history") if isinstance(raw.get("history"), list) else []
    history: list[dict[str, Any]] = []
    for item in history_raw[-80:]:
        if not isinstance(item, dict):
            continue
        target = _normalize_pos(item.get("target"))
        if not target:
            continue
        history.append(
            {
                "side": str(item.get("side") or "") if str(item.get("side") or "") in {"white", "black"} else "",
                "target": target,
                "hit": bool(item.get("hit")),
                "sunk": bool(item.get("sunk")),
                "at": str(item.get("at") or "")[:40],
            }
        )
    state["history"] = history
    return state


def assign_battleship_side(state: dict[str, Any], side: str) -> dict[str, Any]:
    safe = load_battleship_state(copy.deepcopy(state))
    target = "black" if str(side) == "black" else "white"
    safe["players"][target] = create_battleship_player_state()
    if bool(safe["players"]["white"].get("ready")) and bool(safe["players"]["black"].get("ready")):
        safe["turn"] = "white"
    return safe


def _is_cell_shot(value: str) -> bool:
    return str(value or "") in {"H", "M"}


def get_battleship_available_shots(state: dict[str, Any], side: str) -> list[list[int]]:
    safe = load_battleship_state(state)
    me = "black" if str(side) == "black" else "white"
    enemy = "white" if me == "black" else "black"
    board = safe["players"][enemy]["board"]
    out: list[list[int]] = []
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            if not _is_cell_shot(str(board[row][col] or "")):
                out.append([row, col])
    return out


def _ship_by_cell(ships: list[dict[str, Any]], row: int, col: int) -> dict[str, Any] | None:
    for ship in ships:
        for cell in ship.get("cells") or []:
            if int(cell[0]) == int(row) and int(cell[1]) == int(col):
                return ship
    return None


def _ship_sunk(board: list[list[str]], ship: dict[str, Any]) -> bool:
    for cell in ship.get("cells") or []:
        rr, cc = int(cell[0]), int(cell[1])
        if not _inside(rr, cc):
            return False
        if str(board[rr][cc] or "") != "H":
            return False
    return True


def _remaining_ship_cells(board: list[list[str]]) -> int:
    total = 0
    for row in board:
        for cell in row:
            if str(cell or "") == "S":
                total += 1
    return total


def apply_battleship_shot(state: dict[str, Any], side: str, row: int, col: int) -> dict[str, Any]:
    safe = load_battleship_state(copy.deepcopy(state))
    actor_side = "black" if str(side) == "black" else "white"
    if str(safe.get("winner") or "") or str(safe.get("result") or "") in {"draw", "cancelled"}:
        raise ValueError("Game is already finished")
    if actor_side != str(safe.get("turn") or "white"):
        raise ValueError("It is not your turn")
    if not _inside(row, col):
        raise ValueError("Invalid target cell")
    white_ready = bool(safe["players"]["white"].get("ready"))
    black_ready = bool(safe["players"]["black"].get("ready"))
    if not (white_ready and black_ready):
        raise ValueError("Both players are not ready yet")
    enemy = "white" if actor_side == "black" else "black"
    enemy_state = safe["players"][enemy]
    board = _clone_board(enemy_state["board"])
    cell = str(board[row][col] or "")
    if _is_cell_shot(cell):
        raise ValueError("Cell already targeted")
    hit = cell == "S"
    board[row][col] = "H" if hit else "M"
    enemy_state["board"] = board
    ship = _ship_by_cell(enemy_state.get("ships") or [], row, col) if hit else None
    sunk = bool(ship and _ship_sunk(board, ship))
    safe["move_index"] = max(0, int(safe.get("move_index") or 0)) + 1
    move = {
        "side": actor_side,
        "target": [int(row), int(col)],
        "hit": bool(hit),
        "sunk": bool(sunk),
        "at": "",
    }
    safe["last_move"] = move
    history = safe.get("history") if isinstance(safe.get("history"), list) else []
    history = list(history)
    history.append(move)
    safe["history"] = history[-80:]
    if _remaining_ship_cells(board) <= 0:
        safe["winner"] = actor_side
        safe["result"] = "win"
        return safe
    if not hit:
        safe["turn"] = enemy
    # on hit player keeps the turn (classic battleship)
    safe["winner"] = ""
    safe["result"] = ""
    return safe


def _adjacent_targets(board: list[list[str]]) -> list[list[int]]:
    out: list[list[int]] = []
    seen: set[tuple[int, int]] = set()
    for row in range(BOARD_SIZE):
        for col in range(BOARD_SIZE):
            if str(board[row][col] or "") != "H":
                continue
            for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                rr, cc = row + dr, col + dc
                if not _inside(rr, cc):
                    continue
                if _is_cell_shot(str(board[rr][cc] or "")):
                    continue
                key = (rr, cc)
                if key in seen:
                    continue
                seen.add(key)
                out.append([rr, cc])
    return out


def pick_battleship_bot_move(state: dict[str, Any], difficulty: str | None = None) -> dict[str, Any] | None:
    safe = load_battleship_state(state)
    if safe.get("winner") or safe.get("result") in {"draw", "cancelled"}:
        return None
    side = str(safe.get("turn") or "black")
    side = "black" if side == "black" else "white"
    enemy = "white" if side == "black" else "black"
    enemy_board = safe["players"][enemy]["board"]
    all_shots = get_battleship_available_shots(safe, side)
    if not all_shots:
        return None
    meta = get_battleship_difficulty(difficulty)
    code = str(meta.get("code") or "medium")
    adjacent = _adjacent_targets(enemy_board)
    if adjacent and code in {"medium", "hard", "expert"}:
        pick = random.choice(adjacent)
        return {"row": int(pick[0]), "col": int(pick[1])}
    if code in {"hard", "expert"}:
        parity = [shot for shot in all_shots if (int(shot[0]) + int(shot[1])) % 2 == 0]
        if parity:
            all_shots = parity
    pick = random.choice(all_shots)
    return {"row": int(pick[0]), "col": int(pick[1])}


def mask_enemy_board(board: list[list[str]]) -> list[list[str]]:
    out: list[list[str]] = []
    for row in board:
        safe_row: list[str] = []
        for cell in row:
            value = str(cell or "")
            if value == "H":
                safe_row.append("H")
            elif value == "M":
                safe_row.append("M")
            else:
                safe_row.append("")
        out.append(safe_row)
    return out
