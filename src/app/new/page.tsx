import { Brand } from "@/components/Brand";
import { CreateSpaceForm } from "./CreateSpaceForm";

export const metadata = { title: "Start a space | Qoda" };

export default function NewSpacePage() {
  return (
    <main className="narrow">
      <Brand />
      <div className="stack">
        <h1>Start a space</h1>
        <p className="muted">You&apos;ll get a QR code for each queue and a private link for the people running it.</p>
      </div>
      <CreateSpaceForm />
    </main>
  );
}
