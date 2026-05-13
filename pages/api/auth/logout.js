// POST /api/auth/logout — destroys session and redirects home
import { getSession } from "@/lib/auth";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  session.destroy();

  // If submitted via HTML form, redirect; if via fetch, return JSON
  if (req.headers.accept?.includes("text/html")) {
    res.redirect(303, "/");
    return;
  }
  res.json({ ok: true });
}
