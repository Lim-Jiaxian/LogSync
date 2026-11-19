// Database maintenance from the command line. Uses DATABASE_URL if set, otherwise the local PGlite.
//   npm run db:seed    reset to the demo data (keeps users with user_id < 100)
//   npm run db:migrate create any missing tables, without seeding
import { connect, migrate } from "./db.js";

const command = process.argv[2];
const plans = { seed: "always", migrate: "never" };
if (!plans[command]) {
  console.error("Usage: node js/db-cli.js seed|migrate");
  process.exit(1);
}
const db = await connect();
await migrate(db, { seed: plans[command] });
console.log(`${command === "seed" ? "Demo data loaded" : "Schema up to date"} (${db.kind}).`);
await db.close();
