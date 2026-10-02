import Link from "next/link";

export function NoAccess({ title, who, recover }: { title: string; who: string; recover?: boolean }) {
  return (
    <main className="narrow">
      <div className="stack">
        <p className="muted">{title}</p>
        <h1>Open your link to continue</h1>
        <p className="muted">
          This page is only for {who}. Open the private link you were sent on this device and you&apos;ll stay
          signed in for 30 days.
        </p>
        {recover && (
          <p className="muted">
            Lost the link? <Link href="/recover">Email it to me</Link>
          </p>
        )}
      </div>
    </main>
  );
}
