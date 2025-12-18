// src/server/fileManager.ts
import { S3Client } from "@aws-sdk/client-s3";

export type AwsConfig = {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
};

type GlobalCache = {
    s3Client?: S3Client | null;
    awsConfig?: AwsConfig | null;
};

declare global {
    // eslint-disable-next-line no-var
    var __notePolishFileManager: GlobalCache | undefined;
}

const cache: GlobalCache =
    globalThis.__notePolishFileManager ?? (globalThis.__notePolishFileManager = {});

function reqEnv(name: string): string {
    const v = process.env[name]?.trim();
    if (!v) throw new Error(`Missing env var ${name}`);
    return v;
}

export class FileManager {
    static getAwsConfigOrNull(): AwsConfig | null {
        if (cache.awsConfig !== undefined) return cache.awsConfig;

        const accessKey = process.env.AWS_ACCESS_KEY?.trim();

        // Your rule: if no access key, S3 is disabled
        if (!accessKey) {
            cache.awsConfig = null;
            return null;
        }

        // If access key exists, require the rest
        const cfg: AwsConfig = {
            accessKey, // now narrowed to string
            secretKey: reqEnv("AWS_SECRET_KEY"),
            bucket: reqEnv("AWS_S3_BUCKET"),
            region: reqEnv("AWS_S3_REGION"),
        };

        cache.awsConfig = cfg;
        return cfg;
    }

    static getS3OrFalse(): { client: S3Client; cfg: AwsConfig } | false {
        const cfg = this.getAwsConfigOrNull();
        if (!cfg) return false;

        if (cache.s3Client === undefined) {
            cache.s3Client = new S3Client({
                region: cfg.region,
                credentials: {
                    accessKeyId: cfg.accessKey,
                    secretAccessKey: cfg.secretKey,
                },
            });
        }

        return { client: cache.s3Client!, cfg };
    }
}