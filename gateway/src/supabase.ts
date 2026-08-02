export type AuthenticatedUser = {
  id: string;
  email: string;
};

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 503,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createSupabasePasswordAuthenticator(input: {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
}): (email: string, password: string) => Promise<AuthenticatedUser> {
  const fetchImpl = input.fetchImpl ?? fetch;

  return async (email, password) => {
    let response: Response;
    try {
      response = await fetchImpl(
        `${input.supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: input.anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      throw new AuthenticationError("Authentication service unavailable", 503);
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new AuthenticationError(
          "Authentication service unavailable",
          503,
        );
      }
      throw new AuthenticationError("Invalid email or password", 401);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AuthenticationError("Authentication service unavailable", 503);
    }

    const user = isRecord(payload) ? payload.user : undefined;
    if (
      !isRecord(user) ||
      typeof user.id !== "string" ||
      typeof user.email !== "string" ||
      !user.id ||
      !user.email
    ) {
      throw new AuthenticationError("Authentication service unavailable", 503);
    }

    return {
      id: user.id,
      email: user.email.trim().toLowerCase(),
    };
  };
}
