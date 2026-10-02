import { Brand } from "@/components/Brand";
import { RecoverForm } from "./RecoverForm";

export const metadata = { title: "Get your owner link" };

export default function Recover() {
  return (
    <main className="narrow">
      <Brand />
      <div className="stack">
        <h1>Get your owner link</h1>
        <p className="muted">Lost it, or need it on another device? We&apos;ll email it to you.</p>
      </div>
      <RecoverForm />
    </main>
  );
}
