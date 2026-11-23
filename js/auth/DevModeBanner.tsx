/**
 * Persistent marker for an explicitly unauthenticated local deployment.
 *
 * Authentication defaults to enabled; this banner exists only when the build
 * set `AUTH_ENABLED=false`, which the server permits on loopback (or behind an
 * explicit `ALLOW_UNAUTHENTICATED` override).
 */
export function DevModeBanner() {
  return (
    <div
      className="obolargus_dev_banner"
      role="status"
      data-testid="dev-mode-banner"
    >
      Development mode — authentication is disabled. Do not expose this
      deployment.
    </div>
  );
}

export default DevModeBanner;
