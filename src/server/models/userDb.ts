import { ObjectId } from "mongodb";
import type { PublicUser } from "@/lib/models/user";

export type UserDb = {
    _id: ObjectId;
    full_name: string;
    email: string;
    password_hash: string;
    avatar_url?: string;
    created_at: Date;
    updated_at: Date;
};

export function toPublicUser(doc: UserDb): PublicUser {
    return {
        id: doc._id.toString(),
        full_name: doc.full_name,
        email: doc.email,
        avatar_url: doc.avatar_url,
        created_at: doc.created_at.toISOString(),
        updated_at: doc.updated_at.toISOString(),
    };
}

export function toObjectId(id: string): ObjectId {
    return new ObjectId(id);
}