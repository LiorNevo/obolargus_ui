import { apiFetch } from "./http";

/**
 * Shared health probe.
 *
 * Endpoint bindings (portfolios, holdings, transactions, rules, alerts) are
 * added in later iterations; this establishes the base URL wiring.
 */
export async function healthCheck(
  signal?: AbortSignal,
): Promise<{ status: string }> {
  const response = await apiFetch("/health", { signal });
  if (!response.ok) {
    throw new Error(`health check failed with status ${response.status}`);
  }
  return (await response.json()) as { status: string };
}
