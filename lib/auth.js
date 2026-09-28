import { SignJWT, jwtVerify } from 'jose';

// The fallback exists for local development only. In production a missing
// JWT_SECRET must NEVER silently fall back to a value that is committed in a
// public repo — anyone could then forge admin tokens. Fail loudly instead:
// signToken throws (login breaks visibly) and verifyToken fails closed (401s).
const secret = () => {
    const s = process.env.JWT_SECRET;
    if (!s && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is not set — refusing to sign tokens with the development fallback');
    }
    return new TextEncoder().encode(s || 'fallback-dev-secret-change-in-production-123');
};

export async function signToken(payload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(secret());
}

export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, secret());
        return payload;
    } catch {
        return null;
    }
}

export function getTokenFromRequest(req) {
    const auth = req.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

export async function getSession(req) {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    return verifyToken(token);
}

export async function requireAuth(req) {
    const session = await getSession(req);
    if (!session) return { error: 'Unauthorized', status: 401 };
    return { session };
}

export async function requireSuper(req) {
    const session = await getSession(req);
    if (!session) return { error: 'Unauthorized', status: 401 };
    if (session.role !== 'super') return { error: 'Forbidden — super admin only', status: 403 };
    return { session };
}
