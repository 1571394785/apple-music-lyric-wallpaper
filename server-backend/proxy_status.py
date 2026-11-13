"""Short-lived request routing reports, shared across CGI processes."""
import os
import re
import sqlite3
import time

DB = os.path.join(os.path.dirname(__file__), "lyric_cache.db")

def valid_id(value):
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{32}", value) is not None

def connect():
    conn = sqlite3.connect(DB, timeout=0.3)
    conn.execute("CREATE TABLE IF NOT EXISTS proxy_request_status (request_id TEXT PRIMARY KEY, state TEXT, reason TEXT, updated_at INTEGER)")
    return conn

def save(request_id, state, reason=""):
    if not valid_id(request_id):
        return
    try:
        with connect() as conn:
            conn.execute("DELETE FROM proxy_request_status WHERE updated_at < ?", (int(time.time()) - 300,))
            conn.execute("INSERT OR REPLACE INTO proxy_request_status VALUES (?, ?, ?, ?)", (request_id, state, reason, int(time.time())))
    except sqlite3.Error:
        pass  # Reporting must not break the music request.

def read(request_id):
    if not valid_id(request_id):
        return {"state": "unknown"}
    try:
        with connect() as conn:
            row = conn.execute("SELECT state, reason FROM proxy_request_status WHERE request_id = ? AND updated_at >= ?", (request_id, int(time.time()) - 300)).fetchone()
        return {"state": row[0], "reason": row[1]} if row else {"state": "waiting"}
    except sqlite3.Error:
        return {"state": "unknown"}
