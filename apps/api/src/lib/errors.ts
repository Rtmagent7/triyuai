export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in") {
    super(401, "UNAUTHORIZED", message);
  }
}

/** CoinGecko (or another upstream) failed and there was no snapshot to fall back on. */
export class UpstreamError extends AppError {
  constructor(
    public upstreamStatus: number,
    message = "Market data is temporarily unavailable",
  ) {
    super(503, "UPSTREAM_UNAVAILABLE", message);
  }
}
