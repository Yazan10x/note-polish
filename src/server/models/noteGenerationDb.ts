// src/server/models/noteGenerationDb.ts
import { ObjectId } from "mongodb";

/** Styles collection (private, stored in MongoDB) */
export type StylePresetDb = {
    _id: ObjectId;

    key: string;
    title: string;
    image_key: string;
    prompt: string;      // private, never sent to client
    sort_order: number;
    is_active: boolean;

    created_at: Date;
    updated_at: Date;
};

/** Note generations collection (private, stored in MongoDB) */
export type NoteGenerationStatus =
    | "pending"
    | "queued"
    | "processing"
    | "processed"
    | "failed";

export type NoteGenerationDb = {
    _id: ObjectId;
    user_id: ObjectId;

    title?: string;

    status: NoteGenerationStatus;
    error?: string;

    input_text?: string;
    input_files: string[]; // GridFS id strings locally OR S3 keys in prod

    style: {
        mode: "preset" | "custom";
        preset_id?: string;
        custom_prompt?: string;   // keep if you want to show it later in history
        snapshot_prompt: string;  // private, used for reproducibility
        snapshot_title?: string;  // public-safe label
    };

    output_files?: string[];    // FileManager keys

    preview_images?: string[];  // ephemeral base64/data URLs from OpenAI

    is_favourite: boolean;
    is_downloaded: boolean;

    created_at: Date;
    updated_at: Date;
};