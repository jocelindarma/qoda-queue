/** Runs once when the server boots: pick up any emails left in the outbox. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startOutbox } = await import("./lib/outbox");
  startOutbox();
}
