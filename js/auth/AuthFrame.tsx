import type { ReactNode } from "react";

/** Shared shell for the sign-in and session-recovery screens. */
export function AuthFrame({
  titleId,
  title,
  children,
}: {
  /** Id of the heading, used by the card's accessible name. */
  titleId: string;
  /** Screen heading. */
  title: string;
  /** Screen body. */
  children: ReactNode;
}) {
  return (
    <div className="obolargus_auth_screen">
      <main className="obolargus_auth_card" aria-labelledby={titleId}>
        <div className="obolargus_auth_brand">
          <span className="obolargus_auth_mark" aria-hidden="true" />
          <p className="obolargus_auth_eyebrow">Private market workspace</p>
        </div>
        <h1 id={titleId}>{title}</h1>
        {children}
      </main>
    </div>
  );
}

export default AuthFrame;
