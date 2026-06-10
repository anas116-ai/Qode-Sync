// Notification Provider Abstraction Layer
// V1: Email
// Future: Slack, Discord, Telegram, Teams, Web Push

export interface NotificationProvider {
  name: string;
  send(to: string, subject: string, body: string): Promise<boolean>;
}

// V1: Email Provider (via Supabase Edge Function)
class EmailNotificationProvider implements NotificationProvider {
  name = "email";

  async send(to: string, subject: string, body: string): Promise<boolean> {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

let currentProvider: NotificationProvider = new EmailNotificationProvider();

export function setNotificationProvider(provider: NotificationProvider) {
  currentProvider = provider;
}

export function getNotificationProvider(): NotificationProvider {
  return currentProvider;
}