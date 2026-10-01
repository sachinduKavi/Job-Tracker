import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Optional: only needed when the database user cannot CREATE DATABASE
    // (managed MySQL). See docs/setup/database-setup.md.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
