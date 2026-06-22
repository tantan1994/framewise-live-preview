"""Small, deployable relay for Framewise live previews.
Run behind HTTPS in production (for example on Render, Railway or Fly.io).
"""
import asyncio
import os
import secrets
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI(title="Framewise Relay")
allowed_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_methods=["*"], allow_headers=["*"])
sessions: dict[str, dict[str, Any]] = {}
listeners: dict[str, list[asyncio.Queue]] = defaultdict(list)

class FramePayload(BaseModel):
    name: str
    nodeId: str
    width: int
    height: int
    image: str
    updatedAt: str

def get_session(session_id: str) -> dict[str, Any]:
    if session_id not in sessions:
        raise HTTPException(404, "Session not found or expired")
    return sessions[session_id]

def require_viewer(session_id: str, key: str):
    if not secrets.compare_digest(get_session(session_id)["viewerKey"], key):
        raise HTTPException(403, "Invalid viewer key")

@app.post("/api/sessions")
async def create_session():
    session_id = secrets.token_hex(3).upper()
    sessions[session_id] = {
        "publisherToken": secrets.token_urlsafe(24),
        "viewerKey": secrets.token_urlsafe(18),
        "frame": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    session = sessions[session_id]
    return {"id": session_id, "publisherToken": session["publisherToken"], "viewerKey": session["viewerKey"]}

@app.get("/api/sessions/{session_id}")
async def current_frame(session_id: str, key: str = Query(...)):
    require_viewer(session_id, key)
    return {"frame": get_session(session_id)["frame"]}

@app.post("/api/sessions/{session_id}/frame")
async def publish_frame(session_id: str, payload: FramePayload, authorization: Optional[str] = Header(default=None)):
    session = get_session(session_id)
    if authorization != f"Bearer {session['publisherToken']}":
        raise HTTPException(401, "Invalid publisher token")
    frame = payload.model_dump()
    session["frame"] = frame
    for queue in list(listeners[session_id]):
        queue.put_nowait(frame)
    return {"ok": True}

@app.get("/api/sessions/{session_id}/events")
async def events(session_id: str, key: str = Query(...)):
    require_viewer(session_id, key)
    queue: asyncio.Queue = asyncio.Queue()
    listeners[session_id].append(queue)
    async def stream():
        try:
            while True:
                frame = await queue.get()
                import json
                yield f"event: frame\\ndata: {json.dumps(frame)}\\n\\n"
        finally:
            listeners[session_id].remove(queue)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

@app.get("/health")
async def health():
    return {"ok": True}

# The PWA is shipped with the relay so the share link always has one HTTPS origin.
app.mount("/mobile", StaticFiles(directory="../mobile", html=True), name="mobile")
