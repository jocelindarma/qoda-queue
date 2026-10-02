import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Qoda home">
      Qoda
    </Link>
  );
}

export function PoweredBy() {
  return (
    <p className="powered">
      Line managed with <Link href="/">Qoda</Link>
    </p>
  );
}
