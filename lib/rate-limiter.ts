export const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(uid: string, limit: number = 10, windowMs: number = 60000): { allowed: boolean } {
    const now = Date.now();
    const record = rateLimitMap.get(uid);

    if (!record || record.expiresAt < now) {
        rateLimitMap.set(uid, { count: 1, expiresAt: now + windowMs });
        return { allowed: true };
    }

    if (record.count >= limit) {
        return { allowed: false };
    }

    record.count += 1;
    rateLimitMap.set(uid, record);
    return { allowed: true };
}
