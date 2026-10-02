import Link from "next/link";
import { Brand } from "@/components/Brand";

const STEPS = [
  { title: "Scan", text: "A QR code at the entrance or the booth." },
  { title: "Wander", text: "Grab a seat. Your place is saved on your phone." },
  { title: "Come back", text: "The page tells you when it's your turn." },
];

export default function Home() {
  return (
    <main className="narrow">
      <Brand />
      <div className="stack">
        <h1>Lines without the standing around</h1>
        <p className="muted">
          Run one queue or twenty. People join from their phone, see every line and how long it&apos;ll take,
          and keep their place without waiting at the front. No accounts, nothing to install.
        </p>
      </div>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="step-num">{i + 1}</span>
            <div>
              <strong>{s.title}</strong>
              <p className="muted small">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Link href="/new" className="btn btn-block">
        Start a space
      </Link>
    </main>
  );
}
