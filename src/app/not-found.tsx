import Link from "next/link";

export default function NotFound() {
  return (
    <main className="narrow">
      <h1>Nothing here</h1>
      <p className="muted">This queue or ticket doesn&apos;t exist. Check the link, or scan the QR code at the venue again.</p>
      <Link href="/" className="btn btn-ghost">Go to the home page</Link>
    </main>
  );
}
