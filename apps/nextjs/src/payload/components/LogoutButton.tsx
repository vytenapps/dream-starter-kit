/**
 * Payload admin logout button override (admin.components.logout.Button).
 *
 * Payload's default button links to `/admin/logout`, which only clears Payload's
 * local `payload-token`. But this kit disables the local strategy and authenticates
 * the admin entirely from the Supabase session (the SSO bridge), so that default is
 * a no-op — the Supabase session survives and re-authenticates, leaving the user
 * stuck signed in. We instead link to `/cms-logout`, a server route that clears the
 * Supabase session (the single source of CMS auth) and redirects to `/sign-in`.
 *
 * A plain `<a>` (full navigation), not Payload's client `Link`, so the server route
 * actually runs and the cookies are cleared. The markup mirrors Payload's own
 * button — same `nav__log-out` class and log-out icon — so the admin chrome is
 * visually unchanged.
 */
export function LogoutButton() {
  return (
    <a
      aria-label="Log out"
      className="nav__log-out"
      href="/cms-logout"
      title="Log out"
    >
      <svg
        className="icon icon--logout"
        fill="none"
        height="20"
        viewBox="0 0 20 20"
        width="20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="stroke"
          d="M12 16H14.6667C15.0203 16 15.3594 15.8595 15.6095 15.6095C15.8595 15.3594 16 15.0203 16 14.6667V5.33333C16 4.97971 15.8595 4.64057 15.6095 4.39052C15.3594 4.14048 15.0203 4 14.6667 4H12M7.33333 13.3333L4 10M4 10L7.33333 6.66667M4 10H12"
          strokeLinecap="square"
        />
      </svg>
    </a>
  );
}
