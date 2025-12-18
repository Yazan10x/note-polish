// src/server/api/NoteGenerationAPI.ts
import { ObjectId } from "mongodb";

import { ConnectionManager } from "@/lib/ConnectionManager";

import type { NoteGenerationDb, NoteGenerationStatus, StylePresetDb } from "@/server/models/noteGenerationDb";
import type { PublicNoteGeneration, PublicStylePreset } from "@/lib/models/noteGeneration";
import {FileManager} from "@/lib/FileManager";

const COLLECTIONS = {
  stylePresets: "style_presets",
  noteGenerations: "note_generations",
} as const;

function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new Error("Invalid id");
  return new ObjectId(id);
}

function iso(d: Date): string {
  return d.toISOString();
}

function daysAgo(days: number): Date {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

function deriveGenerationTitle(doc: NoteGenerationDb): string {
  const t = doc.input_text?.trim();
  if (t) {
    const firstLine = t.split(/\r?\n/)[0]?.trim() ?? "";
    return firstLine.slice(0, 80) || "Untitled";
  }
  return doc.style?.snapshot_title?.trim() || "Untitled";
}

type DashboardRecentItem = {
  id: string;
  title: string;
  style_label: string;
  status: NoteGenerationStatus;
  created_at: string;
};

export type DashboardResponse = {
  period_days: number;
  metrics: {
    generations_last_period: number;
    downloads_last_period: number;
    favourites_total: number;
    active_styles: number;
  };
  recent_generations: DashboardRecentItem[];
  quick_actions: Array<{
    key: "open_playground" | "view_history";
    title: string;
    href: string;
  }>;
};

type UpdatePendingInput = {
  input_text?: string;
  style:
      | { mode: "preset"; preset_id: string }
      | { mode: "custom"; custom_prompt: string };
};

export class NoteGenerationAPI {
  // 1) Presets list (public safe)
  static async listPublicStylePresets(): Promise<PublicStylePreset[]> {
    const db = await ConnectionManager.getDb();
    const col = db.collection<StylePresetDb>(COLLECTIONS.stylePresets);

    const docs = await col.find({ is_active: true }).sort({ sort_order: 1 }).toArray();

    return docs.map((d) => ({
      id: d._id.toString(),
      key: d.key,
      title: d.title,
      sort_order: d.sort_order,
      image_url: d.image_key, // in your DB it is image_key like "/presets/readable_clean.png"
      created_at: iso(d.created_at),
      updated_at: iso(d.updated_at),
    }));
  }

  // Dashboard (already working)
  static async getDashboard(userId: ObjectId, days = 7, recentLimit = 4): Promise<DashboardResponse> {
    const db = await ConnectionManager.getDb();
    const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);
    const styles = db.collection<StylePresetDb>(COLLECTIONS.stylePresets);

    const since = daysAgo(days);

    const [generations_last_period, downloads_last_period, favourites_total, active_styles] = await Promise.all([
      gens.countDocuments({ user_id: userId, created_at: { $gte: since } }),
      gens.countDocuments({ user_id: userId, is_downloaded: true, updated_at: { $gte: since } }),
      gens.countDocuments({ user_id: userId, is_favourite: true }),
      styles.countDocuments({ is_active: true }),
    ]);

    const recentDocs = await gens
        .find(
            { user_id: userId },
            {
              projection: {
                _id: 1,
                status: 1,
                input_text: 1,
                created_at: 1,
                style: 1,
              },
            }
        )
        .sort({ created_at: -1 })
        .limit(recentLimit)
        .toArray();

    const presetIdStrings = Array.from(
        new Set(
            recentDocs
                .map((d) => (d.style?.mode === "preset" ? d.style.preset_id : undefined))
                .filter((v): v is string => Boolean(v))
        )
    );

    const presetIdObjs = presetIdStrings.filter(ObjectId.isValid).map((s) => new ObjectId(s));

    const presetTitleById = new Map<string, string>();
    if (presetIdObjs.length) {
      const presetDocs = await styles
          .find({ _id: { $in: presetIdObjs } }, { projection: { _id: 1, title: 1 } })
          .toArray();
      for (const p of presetDocs) presetTitleById.set(p._id.toString(), p.title);
    }

    const recent_generations: DashboardRecentItem[] = recentDocs.map((d) => {
      const style_label =
          d.style?.mode === "preset"
              ? presetTitleById.get(d.style.preset_id ?? "") ?? "Preset"
              : d.style?.snapshot_title ?? "Custom";

      return {
        id: d._id.toString(),
        title: deriveGenerationTitle(d),
        style_label,
        status: d.status,
        created_at: iso(d.created_at),
      };
    });

    return {
      period_days: days,
      metrics: {
        generations_last_period,
        downloads_last_period,
        favourites_total,
        active_styles,
      },
      recent_generations,
      quick_actions: [
        { key: "open_playground", title: "Open playground", href: "/dashboard/playground" },
        { key: "view_history", title: "View history", href: "/dashboard/history" },
      ],
    };
  }

  // 2) Get or create the pending generation
  static async getOrCreatePending(userId: ObjectId): Promise<NoteGenerationDb> {
    const db = await ConnectionManager.getDb();
    const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);
    const styles = db.collection<StylePresetDb>(COLLECTIONS.stylePresets);

    const existing = await gens.findOne({ user_id: userId, status: "pending" }, { sort: { updated_at: -1 } });
    if (existing) return existing;

    const defaultPreset = await styles.find({ is_active: true }).sort({ sort_order: 1 }).limit(1).next();
    if (!defaultPreset) throw new Error("No active style presets found");

    const now = new Date();
    const doc: NoteGenerationDb = {
      _id: new ObjectId(),
      user_id: userId,

      status: "pending",

      input_files: [],
      style: {
        mode: "preset",
        preset_id: defaultPreset._id.toString(),
        snapshot_prompt: defaultPreset.prompt,
        snapshot_title: defaultPreset.title,
      },

      is_favourite: false,
      is_downloaded: false,

      created_at: now,
      updated_at: now,
    };

    await gens.insertOne(doc);
    return doc;
  }

  // 3) Update the pending generation (text + style)
  static async updatePending(userId: ObjectId, generationId: string, patch: UpdatePendingInput): Promise<void> {
    const db = await ConnectionManager.getDb();
    const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);
    const styles = db.collection<StylePresetDb>(COLLECTIONS.stylePresets);

    const genId = oid(generationId);

    const current = await gens.findOne({ _id: genId, user_id: userId }, { projection: { status: 1 } });
    if (!current) throw new Error("Not found");
    if (current.status !== "pending") throw new Error("Only pending generations can be edited");

    const $set: Partial<NoteGenerationDb> & { updated_at: Date } = { updated_at: new Date() };

    if (typeof patch.input_text === "string") {
      $set.input_text = patch.input_text;
    }

    if (patch.style.mode === "preset") {
      const preset = await styles.findOne({ _id: oid(patch.style.preset_id), is_active: true });
      if (!preset) throw new Error("Invalid preset");

      $set.style = {
        mode: "preset",
        preset_id: preset._id.toString(),
        snapshot_prompt: preset.prompt,
        snapshot_title: preset.title,
      };
    } else {
      const custom = patch.style.custom_prompt.trim();
      if (!custom) throw new Error("Custom prompt required");

      $set.style = {
        mode: "custom",
        custom_prompt: custom,
        snapshot_prompt: custom,
        snapshot_title: "Custom",
      };
    }

    await gens.updateOne({ _id: genId, user_id: userId }, { $set });
  }

  // Needed by your routes to return public model
  static async toPublic(doc: NoteGenerationDb): Promise<PublicNoteGeneration> {
    const input_files = await Promise.all((doc.input_files ?? []).map((k) => FileManager._get_presigned_url(k)));
    const output_files = doc.output_files?.length
        ? await Promise.all(doc.output_files.map((k) => FileManager._get_presigned_url(k)))
        : undefined;

    return {
      id: doc._id.toString(),

      status: doc.status,
      error: doc.error,

      input_text: doc.input_text,
      input_files,

      style: {
        mode: doc.style.mode,
        preset_id: doc.style.preset_id,
        custom_prompt: doc.style.custom_prompt,
        snapshot_title: doc.style.snapshot_title,
      },

      output_files,
      preview_images: doc.preview_images,

      is_favourite: doc.is_favourite,
      is_downloaded: doc.is_downloaded,

      created_at: iso(doc.created_at),
      updated_at: iso(doc.updated_at),
    };
  }

  static async getById(userId: ObjectId, generationId: string): Promise<NoteGenerationDb | null> {
    const db = await ConnectionManager.getDb();
    const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

    const genOid = oid(generationId);
    return await gens.findOne({ _id: genOid, user_id: userId });
  }

  static async addInputFiles(
      userId: ObjectId,
      generationId: string,
      files: Array<File | Buffer>
  ): Promise<void> {
    const db = await ConnectionManager.getDb();
    const gens = db.collection<NoteGenerationDb>(COLLECTIONS.noteGenerations);

    const genOid = oid(generationId);

    const gen = await gens.findOne(
        { _id: genOid, user_id: userId },
        { projection: { _id: 1, status: 1 } }
    );

    if (!gen) throw new Error("Not found");
    if (gen.status !== "pending") throw new Error("Only pending generations can be edited");

    const keys: string[] = [];
    for (const f of files) {
      const key = await FileManager._upload(f);
      keys.push(key);
    }

    await gens.updateOne(
        { _id: genOid, user_id: userId },
        {
          $push: { input_files: { $each: keys } },
          $set: { updated_at: new Date() },
        }
    );
  }
}


