// src/server/fileManager.ts
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { ObjectId, GridFSBucket } from "mongodb";

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ConnectionManager } from "@/lib/ConnectionManager";

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

type Uploadable = Buffer | Blob;

async function toBuffer(file: Uploadable): Promise<{ buf: Buffer; contentType: string }> {
    if (Buffer.isBuffer(file)) {
        return { buf: file, contentType: "application/octet-stream" };
    }
    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const contentType =
        typeof (file as any).type === "string" && (file as any).type.trim()
            ? (file as any).type.trim()
            : "application/octet-stream";

    return { buf, contentType };
}

async function streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<any>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export class FileManager {
    static getAwsConfigOrNull(): AwsConfig | null {
        if (cache.awsConfig !== undefined) return cache.awsConfig;

        const accessKey = process.env.AWS_ACCESS_KEY?.trim();

        // Rule: if no access key, S3 is disabled
        if (!accessKey) {
            cache.awsConfig = null;
            return null;
        }

        // If access key exists, require the rest
        const cfg: AwsConfig = {
            accessKey,
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

    static async getGridFsBucket(): Promise<GridFSBucket> {
        const db = await ConnectionManager.getDb();
        return new GridFSBucket(db, { bucketName: "files" });
    }

    /**
     * Uploads a file and returns the stored key.
     * - S3: returns S3 object key
     * - GridFS: returns GridFS file id as string
     */
    static async _upload(file: Uploadable, key?: string): Promise<string> {
        const s3 = this.getS3OrFalse();
        const { buf, contentType } = await toBuffer(file);

        if (s3) {
            const finalKey = key ?? `files/${randomUUID()}`;
            await s3.client.send(
                new PutObjectCommand({
                    Bucket: s3.cfg.bucket,
                    Key: finalKey,
                    Body: buf,
                    ContentType: contentType,
                })
            );
            return finalKey;
        }

        const bucket = await this.getGridFsBucket();
        const id = key && ObjectId.isValid(key) ? new ObjectId(key) : new ObjectId();

        await new Promise<void>((resolve, reject) => {
            const uploadStream = bucket.openUploadStreamWithId(id, id.toString(), {
                metadata: { contentType },
            });

            Readable.from(buf)
                .pipe(uploadStream)
                .on("error", reject)
                .on("finish", () => resolve());
        });

        return id.toString();
    }

    /**
     * Downloads file bytes and content type (useful for internal serving routes).
     */
    static async _download_bytes(key: string): Promise<{ buf: Buffer; contentType: string }> {
        const s3 = this.getS3OrFalse();

        if (s3) {
            const res = await s3.client.send(
                new GetObjectCommand({
                    Bucket: s3.cfg.bucket,
                    Key: key,
                })
            );

            if (!res.Body) throw new Error("S3 returned empty body");

            const buf = await streamToBuffer(res.Body);
            const contentType = (res.ContentType?.trim() || "application/octet-stream") as string;
            return { buf, contentType };
        }

        if (!ObjectId.isValid(key)) throw new Error("Invalid GridFS file id");

        const bucket = await this.getGridFsBucket();
        const fileDoc = await bucket.find({ _id: new ObjectId(key) }).limit(1).next();
        if (!fileDoc) throw new Error("File not found");

        const buf = await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            bucket
                .openDownloadStream(new ObjectId(key))
                .on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
                .on("error", reject)
                .on("end", () => resolve(Buffer.concat(chunks)));
        });

        const contentType =
            (typeof (fileDoc as any).contentType === "string" && (fileDoc as any).contentType) ||
            (fileDoc.metadata?.contentType as string | undefined) ||
            "application/octet-stream";

        return { buf, contentType };
    }

    /**
     * Downloads file bytes and returns base64.
     */
    static async _download(key: string): Promise<string> {
        const { buf } = await this._download_bytes(key);
        return buf.toString("base64");
    }

    /**
     * Returns a URL for the client to download.
     * - S3: presigned GET url
     * - GridFS: internal route you must implement, recommended: /files/:key
     */
    static async _get_presigned_url(key: string): Promise<string> {
        const s3 = this.getS3OrFalse();

        if (s3) {
            const cmd = new GetObjectCommand({
                Bucket: s3.cfg.bucket,
                Key: key,
            });
            return await getSignedUrl(s3.client, cmd, { expiresIn: 60 * 30 });
        }

        return `/files/${key}`;
    }
}