// src/worker/consumer.ts
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { randomUUID } from "crypto";
import { ObjectId } from "mongodb";
import { toFile } from "openai";

import { ConnectionManager } from "@/lib/ConnectionManager";
import { FileManager } from "@/lib/FileManager";

import type { NoteGenerationDb } from "@/server/models/noteGenerationDb";

const COLLECTION = "note_generations";

const POLL_MS = 1200;
const BATCH_SLEEP_MS = 200;

// Reclaim "stuck" processing jobs using ONLY updated_at
const STUCK_MS = 10 * 60 * 1000;

const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID().slice(0, 8)}`;

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function claimOne(): Promise<NoteGenerationDb | null> {
    const db = await ConnectionManager.getDb();
    const gens = db.collection<NoteGenerationDb>(COLLECTION);

    const now = new Date();
    const stuckBefore = new Date(now.getTime() - STUCK_MS);

    // findOneAndUpdate returns the updated document (or null) for the filter
    const doc = await gens.findOneAndUpdate(
        {
            $or: [
                { status: "queued" },
                { status: "processing", updated_at: { $lte: stuckBefore } },
            ],
        } as any,
        { $set: { status: "processing", updated_at: now } } as any,
        { sort: { updated_at: 1 }, returnDocument: "after" }
    );

    return doc ?? null;
}

async function markFailed(id: ObjectId, error: string) {
    const db = await ConnectionManager.getDb();
    await db.collection<NoteGenerationDb>(COLLECTION).updateOne(
        { _id: id },
        {
            $set: {
                status: "failed",
                error: error.slice(0, 2000),
                updated_at: new Date(),
            },
        }
    );
}

async function markProcessed(id: ObjectId, outputKeys: string[]) {
    const db = await ConnectionManager.getDb();
    await db.collection<NoteGenerationDb>(COLLECTION).updateOne(
        { _id: id },
        {
            $set: {
                status: "processed",
                output_files: outputKeys,
                updated_at: new Date(),
            },
            $unset: { error: "" },
        } as any
    );
}

async function heartbeat(jobId: ObjectId) {
    const db = await ConnectionManager.getDb();
    await db
        .collection<NoteGenerationDb>(COLLECTION)
        .updateOne({ _id: jobId, status: "processing" }, { $set: { updated_at: new Date() } });
}

function letterPixels(dpi = 300) {
    // 8.5 x 11 inches
    const w = Math.round(8.5 * dpi); // 2550 at 300
    const h = Math.round(11 * dpi);  // 3300 at 300
    return { w, h };
}

function pickOpenAIOutputSize() {
    // OpenAI supports only a few sizes for this model.
    // Closest portrait to "letter-ish" is 1024x1536.
    return "1024x1536" as const;
}

async function generateLetterImageFromBase64(args: {
    inputBase64: string;
    inputMime: string;
    prompt: string;
}): Promise<{ outBase64: string; outMime: string }> {
    const openai = ConnectionManager.getOpenAI();

    // For true letter pixels: { w, h } = letterPixels(300)
    // But OpenAI only supports preset sizes, so we request the closest supported portrait size.
    const _letter = letterPixels(300);
    const size = pickOpenAIOutputSize();

    const bytes = Buffer.from(args.inputBase64, "base64");
    const upload = await toFile(bytes, "input.png", { type: args.inputMime || "image/png" });

    // IMPORTANT:
    // image input + prompt -> use images.edit (not images.generate)
    const rsp: any = await (openai as any).images.edit({
        model: "gpt-image-1.5",
        image: [upload],
        prompt: args.prompt,
        size,
        // Optional, but explicit is fine:
        output_format: "png",
    });

    const b64 = rsp?.data?.[0]?.b64_json;
    if (!b64 || typeof b64 !== "string") {
        throw new Error("OpenAI returned no image data");
    }

    return { outBase64: b64, outMime: "image/png" };
}

async function processJob(job: NoteGenerationDb) {
    if (!job.input_files?.length) throw new Error("No input files attached");

    const firstKey = job.input_files[0]!;
    const { buf, contentType } = await FileManager.downloadBytes(firstKey);

    if (!contentType?.startsWith("image/")) {
        throw new Error(`Input is not an image: ${contentType || "unknown"}`);
    }

    const inputBase64 = buf.toString("base64");

    const prompt = (job.style?.snapshot_prompt || "").trim();
    if (!prompt) throw new Error("Missing snapshot_prompt");

    const { outBase64, outMime } = await generateLetterImageFromBase64({
        inputBase64,
        inputMime: contentType,
        prompt,
    });

    const outBytes = Buffer.from(outBase64, "base64");
    const outBlob = new Blob([outBytes], { type: outMime });

    const outKey = await FileManager.upload(outBlob);
    await markProcessed(job._id, [outKey]);
}

async function main() {
    console.log(`[consumer] starting ${WORKER_ID}`);

    while (true) {
        try {
            const job = await claimOne();

            if (!job) {
                await sleep(POLL_MS);
                continue;
            }

            console.log(`[consumer] claimed ${job._id.toString()}`);

            const hb = setInterval(() => void heartbeat(job._id), 30_000);

            try {
                await processJob(job);
                console.log(`[consumer] done ${job._id.toString()}`);
            } catch (e) {
                const msg = e instanceof Error ? e.message : "Job failed";
                console.log(`[consumer] failed ${job._id.toString()} ${msg}`);
                await markFailed(job._id, msg);
            } finally {
                clearInterval(hb);
            }

            await sleep(BATCH_SLEEP_MS);
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Loop error";
            console.log(`[consumer] loop error ${msg}`);
            await sleep(POLL_MS);
        }
    }
}

void main();