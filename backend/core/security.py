"""
Merizo AI — Security Layer
Implements: rate limiting, account lockout, input validation,
RBAC, audit logging, password reset tokens, MFA groundwork
"""
import time, hashlib, secrets, re, logging
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional
from fastapi import HTTPException, Request

logger = logging.getLogger("merizo.security")

# ── In-memory stores (use Redis in production) ────────────────────────────────
_login_attempts: dict = defaultdict(list)   # ip → [timestamps]
_locked_accounts: dict = {}                 # email → unlock_time
_reset_tokens: dict = {}                    # token → {email, expires, used}
_active_sessions: dict = {}                 # user_id → [token_hashes]
_audit_log: list = []                       # audit trail

# ── Config ────────────────────────────────────────────────────────────────────
MAX_ATTEMPTS_PER_IP  = 10   # per 15 minutes
MAX_ATTEMPTS_ACCOUNT = 5    # before lockout
LOCKOUT_MINUTES      = 15
RESET_TOKEN_MINUTES  = 30
WINDOW_SECONDS       = 900  # 15 min


# ══════════════════════════════════════════════════════════════════════════════
# 1. RATE LIMITING
# ══════════════════════════════════════════════════════════════════════════════
def check_rate_limit(ip: str, endpoint: str = "login"):
    """Block IP after too many requests."""
    key = f"{ip}:{endpoint}"
    now = time.time()
    # Remove old attempts outside window
    _login_attempts[key] = [t for t in _login_attempts[key] if now - t < WINDOW_SECONDS]
    
    if len(_login_attempts[key]) >= MAX_ATTEMPTS_PER_IP:
        logger.warning(f"Rate limit hit: {ip} on {endpoint}")
        audit("RATE_LIMIT", ip=ip, detail=f"endpoint={endpoint}")
        raise HTTPException(429, "Too many attempts. Please wait 15 minutes.")
    
    _login_attempts[key].append(now)


# ══════════════════════════════════════════════════════════════════════════════
# 2. ACCOUNT LOCKOUT
# ══════════════════════════════════════════════════════════════════════════════
_account_attempts: dict = defaultdict(list)

def record_failed_login(email: str, ip: str):
    """Track failed logins per account."""
    now = time.time()
    _account_attempts[email] = [t for t in _account_attempts[email] if now - t < WINDOW_SECONDS]
    _account_attempts[email].append(now)
    
    count = len(_account_attempts[email])
    if count >= MAX_ATTEMPTS_ACCOUNT:
        unlock_at = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        _locked_accounts[email] = unlock_at
        logger.warning(f"Account locked: {email} after {count} attempts from {ip}")
        audit("ACCOUNT_LOCKED", email=email, ip=ip, detail=f"attempts={count}")

def check_account_locked(email: str):
    """Raise if account is temporarily locked."""
    if email in _locked_accounts:
        unlock_at = _locked_accounts[email]
        if datetime.utcnow() < unlock_at:
            remaining = int((unlock_at - datetime.utcnow()).total_seconds() / 60) + 1
            raise HTTPException(423, f"Account temporarily locked. Try again in {remaining} minutes.")
        else:
            del _locked_accounts[email]
            _account_attempts[email] = []

def clear_failed_attempts(email: str):
    """Clear on successful login."""
    _account_attempts.pop(email, None)
    _locked_accounts.pop(email, None)


# ══════════════════════════════════════════════════════════════════════════════
# 3. INPUT VALIDATION
# ══════════════════════════════════════════════════════════════════════════════
EMAIL_RE    = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
PASSWORD_RE = re.compile(r'^.{8,128}$')  # 8-128 chars

def validate_email(email: str) -> str:
    email = email.strip().lower()[:254]
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Invalid email format")
    return email

def validate_password(password: str):
    if not PASSWORD_RE.match(password):
        raise HTTPException(422, "Password must be 8-128 characters")

def sanitize_name(name: str) -> str:
    """Strip HTML/script injection from name fields."""
    name = name.strip()[:100]
    name = re.sub(r'<[^>]+>', '', name)       # strip HTML tags
    name = re.sub(r'[^\w\s\-\.\,]', '', name) # allow only safe chars
    if not name:
        raise HTTPException(422, "Invalid name")
    return name

def sanitize_string(s: str, max_len: int = 500) -> str:
    """General string sanitizer."""
    s = s.strip()[:max_len]
    s = re.sub(r'<[^>]+>', '', s)
    return s


# ══════════════════════════════════════════════════════════════════════════════
# 4. PASSWORD RESET TOKENS
# ══════════════════════════════════════════════════════════════════════════════
def create_reset_token(email: str) -> str:
    """Create single-use expiring reset token."""
    # Invalidate any existing token for this email
    for tok, data in list(_reset_tokens.items()):
        if data["email"] == email:
            del _reset_tokens[tok]
    
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        "email": email,
        "expires": datetime.utcnow() + timedelta(minutes=RESET_TOKEN_MINUTES),
        "used": False,
    }
    audit("RESET_TOKEN_CREATED", email=email)
    return token

def consume_reset_token(token: str) -> str:
    """Validate and consume a reset token. Returns email."""
    data = _reset_tokens.get(token)
    if not data:
        raise HTTPException(400, "Invalid or expired reset link")
    if data["used"]:
        raise HTTPException(400, "Reset link already used")
    if datetime.utcnow() > data["expires"]:
        del _reset_tokens[token]
        raise HTTPException(400, "Reset link has expired")
    
    data["used"] = True
    email = data["email"]
    audit("RESET_TOKEN_CONSUMED", email=email)
    return email


# ══════════════════════════════════════════════════════════════════════════════
# 5. SESSION MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════
def register_session(user_id: str, token: str):
    """Track active sessions per user."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if user_id not in _active_sessions:
        _active_sessions[user_id] = []
    # Keep max 5 sessions
    _active_sessions[user_id].append(token_hash)
    if len(_active_sessions[user_id]) > 5:
        _active_sessions[user_id] = _active_sessions[user_id][-5:]

def invalidate_all_sessions(user_id: str):
    """Invalidate all sessions after password reset."""
    _active_sessions.pop(user_id, None)
    audit("SESSIONS_INVALIDATED", user_id=user_id)


# ══════════════════════════════════════════════════════════════════════════════
# 6. RBAC — Role-Based Access Control
# ══════════════════════════════════════════════════════════════════════════════
ROLES = {
    "user":  ["read_own", "write_own", "ai_basic"],
    "pro":   ["read_own", "write_own", "ai_full", "export", "analytics"],
    "admin": ["read_all", "write_all", "ai_full", "export", "analytics", "moderate"],
}

def check_permission(user: dict, permission: str):
    """Check if user has a specific permission."""
    role = user.get("role", "user")
    allowed = ROLES.get(role, ROLES["user"])
    if permission not in allowed:
        audit("PERMISSION_DENIED", user_id=user.get("id"), detail=f"perm={permission}")
        raise HTTPException(403, "You don't have permission to do this")

def require_owner(user: dict, resource_user_id: str):
    """Ensure user owns the resource they're accessing."""
    if user.get("role") == "admin":
        return
    if user["id"] != resource_user_id:
        audit("UNAUTHORIZED_ACCESS", user_id=user.get("id"), detail=f"tried to access {resource_user_id}")
        raise HTTPException(403, "Access denied")


# ══════════════════════════════════════════════════════════════════════════════
# 7. AUDIT LOGGING
# ══════════════════════════════════════════════════════════════════════════════
def audit(event: str, user_id: str = None, email: str = None, ip: str = None, detail: str = None):
    """Log security events for monitoring."""
    entry = {
        "ts":      datetime.utcnow().isoformat(),
        "event":   event,
        "user_id": user_id,
        "email":   email[:50] if email else None,  # truncate for privacy
        "ip":      ip,
        "detail":  detail,
    }
    _audit_log.append(entry)
    # Keep last 10000 events in memory
    if len(_audit_log) > 10000:
        _audit_log.pop(0)
    
    # Log suspicious events
    suspicious = ["RATE_LIMIT", "ACCOUNT_LOCKED", "PERMISSION_DENIED", "UNAUTHORIZED_ACCESS"]
    if event in suspicious:
        logger.warning(f"SECURITY [{event}] user={user_id} ip={ip} {detail or ''}")
    else:
        logger.info(f"AUDIT [{event}] user={user_id}")

def get_recent_audit(limit: int = 100) -> list:
    return _audit_log[-limit:]


# ══════════════════════════════════════════════════════════════════════════════
# 8. REQUEST HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def get_client_ip(request: Request) -> str:
    """Extract real client IP (handles proxies/CDN)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"
