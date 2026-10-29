import { PrismaClient } from "./generated/prisma/client";

export type Db = PrismaClient;

/**
 * Production connects to Neon with the standard pg driver. `pglite:<dir>` starts an
 * embedded Postgres (PGlite) instead, so local development needs no database server.
 */
export async function createDb(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { PrismaPGlite } = await import("pglite-prisma-adapter");
    const dir = url.slice("pglite:".length);
    const pglite = dir === "memory" ? new PGlite() : new PGlite(dir);
    await migratePglite(pglite);
    return new PrismaClient({ adapter: new PrismaPGlite(pglite) });
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Applies prisma/migrations/*.sql to an embedded database (Neon uses `prisma migrate deploy`). */
async function migratePglite(pglite: import("@electric-sql/pglite").PGlite) {
  const { readdir, readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.resolve(import.meta.dirname, "../prisma/migrations");
  await pglite.exec(`CREATE TABLE IF NOT EXISTS "_local_migrations" ("name" TEXT PRIMARY KEY)`);
  const done = new Set(
    (await pglite.query<{ name: string }>(`SELECT "name" FROM "_local_migrations"`)).rows.map(
      (r) => r.name,
    ),
  );
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const name of names) {
    if (done.has(name)) continue;
    await pglite.exec(await readFile(path.join(dir, name, "migration.sql"), "utf8"));
    await pglite.query(`INSERT INTO "_local_migrations" ("name") VALUES ($1)`, [name]);
  }
}
