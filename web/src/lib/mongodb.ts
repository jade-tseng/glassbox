import { MongoClient, type Db } from "mongodb";

// Reuse one client across hot reloads (dev) and warm serverless invocations (Vercel).
const globalForMongo = globalThis as unknown as { _mongoClient?: Promise<MongoClient> };

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see web/.env.example)");
  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(uri, {
      appName: "glassbox",
      serverSelectionTimeoutMS: 8000,
    })
      .connect()
      .catch((err) => {
        // Don't cache a failed connection; retry on the next request.
        globalForMongo._mongoClient = undefined;
        throw err;
      });
  }
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB ?? "glassbox");
}
