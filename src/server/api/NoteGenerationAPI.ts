import { ObjectId } from "mongodb";

import { ConnectionManager } from "@/lib/ConnectionManager";
import type { NoteGenerationDb, StylePresetDb, NoteGenerationStatus } from "@/server/models/noteGenerationDb";

export type UserDashboard = {
    period_days: number;

    metrics: {
        generations_last_period: number;
        downloads_last_period: number;
        favourites_total: number;
        active_styles: number;
    };

    recent_generations: Array<{
        id: string;
        title: string;
        style_label: string;
        status: NoteGenerationStatus;
        created_at: string;
    }>;

    quick_actions: Array<{
        key: "open_playground" | "view_history";
        title: string;
        href: string;
    }>;
};

function clampInt(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function previewTitleFromInputText(inputText?: string): string {
    if (!inputText) return "Untitled";
    const firstLine = inputText.split("\n").map((s) => s.trim()).find(Boolean);
    if (!firstLine) return "Untitled";
    return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
}

export class NoteGenerationAPI {
    static generationsCollectionName = "note_generations";
    static stylePresetsCollectionName = "style_presets";

    static async getDashboard(userId: ObjectId, days: number = 7): Promise<UserDashboard> {
        const periodDays = clampInt(days, 1, 90);
        const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

        const db = await ConnectionManager.getDb();
        const gens = db.collection<NoteGenerationDb>(this.generationsCollectionName);
        const presets = db.collection<StylePresetDb>(this.stylePresetsCollectionName);

        const generationsLastPeriodPromise = gens.countDocuments({
            user_id: userId,
            created_at: { $gte: since },
        });

        const favouritesTotalPromise = gens.countDocuments({
            user_id: userId,
            is_favourite: true,
        });

        const activeStylesPromise = presets.countDocuments({
            is_active: true,
        });

        // Approximation: we only have is_downloaded boolean (no downloaded_at yet),
        // so we count "marked downloaded and updated within period".
        const downloadsLastPeriodPromise = gens.countDocuments({
            user_id: userId,
            is_downloaded: true,
            updated_at: { $gte: since },
        });

        const recentDocsPromise = gens
            .find(
                { user_id: userId },
                {
                    projection: {
                        _id: 1,
                        status: 1,
                        input_text: 1,
                        style: 1,
                        created_at: 1,
                    },
                }
            )
            .sort({ created_at: -1 })
            .limit(4)
            .toArray();

        const [
            generations_last_period,
            downloads_last_period,
            favourites_total,
            active_styles,
            recentDocs,
        ] = await Promise.all([
            generationsLastPeriodPromise,
            downloadsLastPeriodPromise,
            favouritesTotalPromise,
            activeStylesPromise,
            recentDocsPromise,
        ]);

        return {
            period_days: periodDays,
            metrics: {
                generations_last_period,
                downloads_last_period,
                favourites_total,
                active_styles,
            },
            recent_generations: recentDocs.map((d) => ({
                id: d._id.toString(),
                title: previewTitleFromInputText(d.input_text),
                style_label: d.style?.snapshot_title ?? (d.style?.mode === "custom" ? "Custom" : "Preset"),
                status: d.status,
                created_at: d.created_at.toISOString(),
            })),
            quick_actions: [
                { key: "open_playground", title: "Open playground", href: "/dashboard/playground" },
                { key: "view_history", title: "View history", href: "/dashboard/history" },
            ],
        };
    }

    // Stubs for the rest of the API, to fill in after dashboard

    static async createOrGetPending(_userId: ObjectId): Promise<NoteGenerationDb> {
        throw new Error("Not implemented");
    }

    static async updateGeneration(_userId: ObjectId, _generationId: ObjectId, _patch: unknown): Promise<NoteGenerationDb> {
        throw new Error("Not implemented");
    }

    static async startProcessing(_userId: ObjectId, _generationId: ObjectId): Promise<void> {
        throw new Error("Not implemented");
    }

    static async getGeneration(_userId: ObjectId, _generationId: ObjectId): Promise<NoteGenerationDb | null> {
        throw new Error("Not implemented");
    }

    static async listGenerations(_userId: ObjectId, _opts?: unknown): Promise<NoteGenerationDb[]> {
        throw new Error("Not implemented");
    }

    static async deleteGeneration(_userId: ObjectId, _generationId: ObjectId): Promise<void> {
        throw new Error("Not implemented");
    }

    static async setFavourite(_userId: ObjectId, _generationId: ObjectId, _isFavourite: boolean): Promise<void> {
        throw new Error("Not implemented");
    }

    static async setDownloaded(_userId: ObjectId, _generationId: ObjectId, _isDownloaded: boolean): Promise<void> {
        throw new Error("Not implemented");
    }
}