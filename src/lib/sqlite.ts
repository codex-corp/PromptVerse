import Database from "better-sqlite3";
import path from "node:path";

let dbInstance: Database.Database | null = null;

function resolveDatabasePath() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (url.startsWith("file:")) {
    const relativePath = url.replace(/^file:/, "");
    return path.resolve(process.cwd(), relativePath);
  }

  return url;
}

export function getDatabase() {
  if (!dbInstance) {
    const dbPath = resolveDatabasePath();
    dbInstance = new Database(dbPath, {
      fileMustExist: true,
    });
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.pragma("foreign_keys = ON");
  }

  return dbInstance;
}

export type SQLiteDatabase = ReturnType<typeof getDatabase>;
