export const metadata = { title: "Link no longer works" };

export default function LinkExpired() {
  return (
    <main className="narrow">
      <h1>This link no longer works</h1>
      <p className="muted">
        It was replaced with a new one, or it was copied incorrectly. Ask the person who runs this space to send
        you the current link.
      </p>
    </main>
  );
}
