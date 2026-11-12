type UsageBucket = { startedAt: number; count: number };

export class AssistantUsageGuard {
  private readonly buckets = new Map<string, UsageBucket>();

  consume(
    userId: string,
    options: { now?: number; limit: number; windowMs?: number },
  ) {
    const now = options.now ?? Date.now();
    const windowMs = options.windowMs ?? 60_000;
    const limit = Math.max(1, Math.floor(options.limit));
    const current = this.buckets.get(userId);

    if (!current || now - current.startedAt >= windowMs) {
      this.buckets.set(userId, { startedAt: now, count: 1 });
      this.prune(now, windowMs);
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, windowMs - (now - current.startedAt)),
      };
    }

    current.count += 1;
    return {
      allowed: true,
      remaining: limit - current.count,
      retryAfterMs: 0,
    };
  }

  private prune(now: number, windowMs: number) {
    if (this.buckets.size < 1_000) return;
    for (const [userId, bucket] of this.buckets) {
      if (now - bucket.startedAt >= windowMs) this.buckets.delete(userId);
    }
  }
}

export const assistantUsageGuard = new AssistantUsageGuard();
