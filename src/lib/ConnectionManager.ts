import OpenAI from "openai";
import { Db, MongoClient } from "mongodb";

export type ServerConfig = {
    openaiApiKey: string;
    mongodbUri: string;
    mongodbDb: string;
};

type GlobalCache = {
    config?: ServerConfig;
    mongoClient?: MongoClient;
    mongoClientPromise?: Promise<MongoClient>;
    openai?: OpenAI;
};

declare global {
    // eslint-disable-next-line no-var
    var __notePolishConnections: GlobalCache | undefined;
}

const cache: GlobalCache =
    globalThis.__notePolishConnections ?? (globalThis.__notePolishConnections = {});

export class ConnectionManager {
    static getConfig(): ServerConfig {
        if (cache.config) return cache.config;

        const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
        const mongodbUri = process.env.MONGODB_URI?.trim();
        const mongodbDb = process.env.MONGODB_DB?.trim();

        if (!openaiApiKey) throw new Error("Missing env var OPENAI_API_KEY");
        if (!mongodbUri) throw new Error("Missing env var MONGODB_URI");
        if (!mongodbDb) throw new Error("Missing env var MONGODB_DB");

        cache.config = { openaiApiKey, mongodbUri, mongodbDb };
        return cache.config;
    }

    static getOpenAI(): OpenAI {
        if (cache.openai) return cache.openai;

        const { openaiApiKey } = this.getConfig();
        cache.openai = new OpenAI({ apiKey: openaiApiKey });
        return cache.openai;
    }

    static async getMongoClient(): Promise<MongoClient> {
        if (cache.mongoClient) return cache.mongoClient;

        if (!cache.mongoClientPromise) {
            const { mongodbUri } = this.getConfig();
            const client = new MongoClient(mongodbUri);

            cache.mongoClientPromise = client.connect().then((connected) => {
                cache.mongoClient = connected;
                return connected;
            });
        }

        return cache.mongoClientPromise;
    }

    static async getDb(): Promise<Db> {
        const client = await this.getMongoClient();
        const { mongodbDb } = this.getConfig();
        return client.db(mongodbDb);
    }
}