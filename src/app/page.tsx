import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function Home() {
  return (
    <main className="narrow">
      <Brand />
      <div className="ticket">
        <p className="ticket-venue">Now serving</p>
        <p className="ticket-number">A-024</p>
        <div className="ticket-perf" />
        <p>People scan a QR code, get a number, and wait wherever they like.</p>
      </div>
      <div className="stack">
        <h1>Lines without the standing around</h1>
        <p className="muted">
          Run one queue or twenty. People join from their phone, see how long the wait is, and get an email when
          it&apos;s their turn. No accounts, nothing to install.
        </p>
        <Link href="/new" className="btn btn-block">
          Start a space
        </Link>
      </div>
    </main>
  );
}
