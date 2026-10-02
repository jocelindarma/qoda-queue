import Link from "next/link";

export const metadata = { title: "Link no longer works" };

export default function LinkExpired() {
  return (
    <main className="narrow">
      <h1>This link no longer works</h1>
      <p className="muted">
        It was replaced with a new one, or it was copied incorrectly. Ask the person who runs this space to send
        you the current link.
      </p>
      <p className="muted">
        Own this space? <Link href="/recover">Email me my owner link</Link>
      </p>
    </main>
  );
}
