// Shown at the top of the tenant dashboard when the current session was minted
// by a platform admin via /platform/tenants/:id/managed-session. Pure UI hint
// based on JWT claims \u2014 not a security boundary.
export default function ManagedBanner({ managerEmail }) {
  if (!managerEmail) return null;
  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-50 bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs sm:text-sm text-blue-900 text-center"
    >
      Your account manager <strong>{managerEmail}</strong> is configuring this account for you.
      Changes you see were made on your behalf and are logged.
    </div>
  );
}
