type SlackEvent = "signup" | "upgrade" | "credits";

export async function notifySlack(event: SlackEvent, text: string) {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;

  const titles: Record<SlackEvent, string> = {
    signup: "New Leitmotif writer",
    upgrade: "Plan upgrade",
    credits: "Credit limit reached",
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${titles[event]}*\n${text}`,
      }),
    });
  } catch {
    // Notifications should never block the product path.
  }
}
