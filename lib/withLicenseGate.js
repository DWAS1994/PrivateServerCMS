// Gate every page that uses getServerSideProps by wrapping it with this helper.
//
// Behavior:
//   - If install wizard not completed → redirect to /install
//   - Else if license is locked (no key / cancelled / past_due / refunded /
//     signature failed for too long) → redirect to /licensed-expired
//   - Else call the wrapped getServerSideProps normally
//
// Skip gating on:
//   /install, /licensed-expired, /api/install/*, /api/license-status,
//   /_next/*, static files (these never call this helper anyway).
import { isInstalled, checkLicense } from "./license";

/**
 * Wrap a getServerSideProps function with install + license gating.
 *
 * Usage:
 *   export const getServerSideProps = withLicenseGate(async (ctx) => {
 *     // ...your normal getServerSideProps body
 *     return { props: { ... } };
 *   });
 *
 * Or, if you don't have a getServerSideProps but want a page to be gated:
 *   export const getServerSideProps = withLicenseGate();
 *   // → returns { props: { gated: true } } on success.
 */
export function withLicenseGate(handler) {
  return async (ctx) => {
    if (!(await isInstalled())) {
      return { redirect: { destination: "/install", permanent: false } };
    }
    const { locked } = await checkLicense();
    if (locked) {
      return { redirect: { destination: "/licensed-expired", permanent: false } };
    }
    if (handler) return handler(ctx);
    return { props: {} };
  };
}
