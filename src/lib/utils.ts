import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatRelativeTime(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

export const severityColors: Record<string, string> = {
  critical: "text-red-500 bg-red-50 dark:bg-red-950",
  high: "text-orange-500 bg-orange-50 dark:bg-orange-950",
  medium: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950",
  low: "text-brand-500 bg-brand-50 dark:bg-brand-950",
};

export const syncStatusColors: Record<string, string> = {
  synced: "text-brand-500", behind: "text-red-500", ahead: "text-warm-500",
  diverged: "text-orange-500", unknown: "text-gray-500",
};