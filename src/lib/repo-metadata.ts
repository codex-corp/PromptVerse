import { execSync } from "node:child_process";

const LAST_COMMIT_COMMAND = "git log -1 --format=%cI";

function getLastCommitIsoString(): string | null {
  try {
    const output = execSync(LAST_COMMIT_COMMAND, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();

    return output || null;
  } catch (error) {
    return null;
  }
}

function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export async function getRepoMetadata(): Promise<{
  lastUpdatedLabel: string;
  currentYear: number;
}> {
  const isoString = getLastCommitIsoString();
  const lastUpdatedDate = isoString ? new Date(isoString) : new Date();

  const lastUpdatedLabel = `Updated: ${formatMonthYear(lastUpdatedDate)}`;
  const currentYear = new Date().getFullYear();

  return { lastUpdatedLabel, currentYear };
}
