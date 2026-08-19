import Link from "next/link";
import { logout } from "@/app/login/actions";

export function Nav({ name }: { name: string }) {
  return (
    <header className="top-nav">
      <div className="page-shell top-nav-inner">
        <Link href="/" className="serif" style={{ fontSize: 18, fontWeight: 600 }}>
          Read me when… <span aria-hidden>♡</span>
        </Link>
        <nav className="top-links" aria-label="Main navigation">
          <Link className="optional" href="/finland">Finland chapter</Link>
          <Link className="optional" href="/manage">Your letters</Link>
          <Link href="/create" aria-label="Create a letter">＋</Link>
          <form action={logout}>
            <button className="link-button" title={`Signed in as ${name}`}>Leave</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
