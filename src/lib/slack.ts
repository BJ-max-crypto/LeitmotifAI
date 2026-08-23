type SlackEvent =
  | {
      type: "signup";
      name: string;
      email: string;
    }
  | {
      type: "upgrade";
      name: string;
      email: string;
      plan: "pro" | "pro_plus";
    }
  | {
      type: "credit_limit";
      name: string;
      email: string;
      used: number;
      limit: number;
    };

function eventPayload(event: SlackEvent) {
  switch (event.type) {
    case "signup":
      return {
        text: `New signup: ${event.name}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "New user signup" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Name*\n${event.name}` },
              { type: "mrkdwn", text: `*Email*\n${event.email}` },
            ],
          },
        ],
      };
    case "upgrade":
      return {
        text: `${event.name} upgraded to ${event.plan}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Plan upgrade" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Name*\n${event.name}` },
              { type: "mrkdwn", text: `*Email*\n${event.email}` },
              {
                type: "mrkdwn",
                text: `*Plan*\n${event.plan === "pro" ? "Pro ($20/mo)" : "Pro Plus ($40/mo)"}`,
              },
            ],
          },
        ],
      };
    case "credit_limit":
      return {
        text: `${event.name} hit the free credit limit (${event.used}/${event.limit})`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Free credit limit reached" },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Name*\n${event.name}` },
              { type: "mrkdwn", text: `*Email*\n${event.email}` },
              {
                type: "mrkdwn",
                text: `*Credits*\n${event.used} / ${event.limit}`,
              },
            ],
          },
        ],
      };
  }
}

async function postWebhook(payload: ReturnType<typeof eventPayload>) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return response.ok;
}

async function postChatMessage(payload: ReturnType<typeof eventPayload>) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return false;

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel,
      text: payload.text,
      blocks: payload.blocks,
    }),
  });

  const data = (await response.json()) as { ok?: boolean; error?: string };
  return Boolean(data.ok);
}

export async function notifySlack(event: SlackEvent): Promise<void> {
  const payload = eventPayload(event);

  try {
    const sentViaWebhook = await postWebhook(payload);
    if (sentViaWebhook) return;
    await postChatMessage(payload);
  } catch (error) {
    console.error("Slack notification failed", error);
  }
}
