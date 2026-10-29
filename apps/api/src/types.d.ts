declare global {
  namespace Express {
    interface Request {
      /** Set by the auth middleware when a valid access token cookie is present. */
      userId?: string;
    }
  }
}

export {};
