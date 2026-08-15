import { API_BASE_URL } from "./config";

/**
 * Placeholder REST client for the obolargus-server API.
 *
 * Real endpoint bindings (portfolios, holdings, transactions, rules, alerts)
 * are added in later iterations; this establishes the base URL wiring.
 */
export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`health check failed with status ${response.status}`);
  }
  return (await response.json()) as { status: string };
}