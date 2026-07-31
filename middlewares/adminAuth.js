import crypto from "crypto";

// In-memory admin sessions: token -> expiry timestamp.
// Sessions do not survive a server restart, which is fine for this admin area.
const sessions = new Map();

const SESSION_COOKIE = 'adminToken';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function createAdminSession(res) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL_MS);

    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_MS
    });
}

function destroyAdminSession(req, res) {
    const token = getTokenFromRequest(req);
    if (token != null) {
        sessions.delete(token);
    }
    res.clearCookie(SESSION_COOKIE);
}

function getTokenFromRequest(req) {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader == null) return null;

    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === SESSION_COOKIE) {
            return value;
        }
    }
    return null;
}

function isAdminAuthenticated(req) {
    const token = getTokenFromRequest(req);
    if (token == null) return false;

    const expiry = sessions.get(token);
    if (expiry == null) return false;

    if (Date.now() > expiry) {
        sessions.delete(token);
        return false;
    }
    return true;
}

function requireAdmin(req, res, next) {
    if (isAdminAuthenticated(req)) {
        return next();
    }
    res.redirect('/admin/login');
}

export {
    createAdminSession,
    destroyAdminSession,
    isAdminAuthenticated,
    requireAdmin
}
