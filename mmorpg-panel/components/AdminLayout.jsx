// Admin panel sidebar layout (composed with Layout, so it inherits the
// notification bell + user dropdown automatically).
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "./Layout";

const ADMIN_NAV = [
  { section: "Overview" },
  { href: "/admin", label: "Dashboard" },
  { section: "Server" },
  { href: "/admin/settings", label: "Server Settings" },
  { href: "/admin/game-db", label: "Game DB" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/monsters", label: "Monsters" },
  { href: "/admin/downloads", label: "Downloads" },
  { section: "Community" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/notifications", label: "Broadcast" },
  { href: "/admin/users", label: "Users" },
  { section: "Billing" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/license", label: "License" },
];

export default function AdminLayout({ user, server, title, children }) {
  const router = useRouter();
  return (
    <Layout user={user} server={server}>
      <div className="container page">
        <div className="page-header">
          <div>
            <div className="kicker">Admin Panel</div>
            <h1 className="page-title">{title}</h1>
          </div>
        </div>
        <div className="admin-grid">
          <aside className="admin-sidebar">
            {ADMIN_NAV.map((item, i) =>
              item.section ? (
                <div key={i} className="admin-sidebar-label">
                  {item.section}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={router.pathname === item.href ? "active" : ""}
                >
                  {item.label}
                </Link>
              )
            )}
          </aside>
          <div>{children}</div>
        </div>
      </div>
    </Layout>
  );
}
