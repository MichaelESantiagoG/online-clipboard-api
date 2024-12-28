import { corsHeaders } from '../utils/cors.js';

export class Clip {
    constructor(database) {
        this.db = database;
        this.MAX_CONTENT_SIZE = 1024 * 1024; // 1MB
        this.MAX_CLIPS_PER_HOUR = 10;
    }

    async checkRateLimit(ip_address) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const stmt = this.db.prepare(
            "SELECT COUNT(*) as count FROM clip WHERE created_by_ip = ? AND created_at > ?"
        );
        const { results } = await stmt.bind(ip_address, oneHourAgo).all();
        return results[0].count >= this.MAX_CLIPS_PER_HOUR;
    }

    async newClip(exp, content, ip_address, user_id = null) {
        // Validate content size
        if (new TextEncoder().encode(content).length > this.MAX_CONTENT_SIZE) {
            throw new Error("Content size exceeds maximum limit of 1MB");
        }

        // Check rate limit
        if (await this.checkRateLimit(ip_address)) {
            throw new Error("Rate limit exceeded. Please try again later.");
        }

        const clip_id = Math.random().toString(36).substring(2, 8);
        const now = new Date();
        const expiration = new Date(now.getTime() + exp * 60 * 60 * 1000);

        const stmt = this.db.prepare(`
            INSERT INTO clip (
                clip_id, content, created_at, expires_at, 
                created_by_ip, user_id
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        await stmt.bind(
            clip_id,
            content,
            now.toISOString(),
            expiration.toISOString(),
            ip_address,
            user_id
        ).run();

        return clip_id;
    }

    async getClip(clip_id) {
        const stmt = this.db.prepare(`
            SELECT clip_id, content, created_at, expires_at, user_id 
            FROM clip 
            WHERE clip_id = ? 
            AND (expires_at > datetime('now') OR expires_at IS NULL)
        `);

        const { results } = await stmt.bind(clip_id).all();
        return results.length > 0 ? results[0] : null;
    }

    async getUserClips(user_id) {
        const stmt = this.db.prepare(`
            SELECT clip_id, content, created_at, expires_at
            FROM clip 
            WHERE user_id = ? 
            AND (expires_at > datetime('now') OR expires_at IS NULL)
            ORDER BY created_at DESC
        `);

        const { results } = await stmt.bind(user_id).all();
        return results;
    }
}

export async function handleClipEndpoint(request, database) {
    const clip = new Clip(database);
    const url = new URL(request.url);
    const pathname = url.pathname;
    const clip_id = url.searchParams.get("id");
    const user_id = url.searchParams.get("user_id");
    const ip_address = request.headers.get("CF-Connecting-IP");

    if (pathname === "/clip" && request.method === "POST") {
        try {
            const { content, expiration = 24, user_id = null } = await request.json();
            if (!content) {
                return new Response(
                    JSON.stringify({ error: "Content is required" }),
                    { status: 400, headers: corsHeaders }
                );
            }
            const newClipId = await clip.newClip(expiration, content, ip_address, user_id);
            return new Response(
                JSON.stringify({ clip_id: newClipId }),
                { headers: corsHeaders }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 400, headers: corsHeaders }
            );
        }
    } else if (pathname === "/clip" && request.method === "GET" && clip_id) {
        const result = await clip.getClip(clip_id);
        if (!result) {
            return new Response(
                JSON.stringify({ error: "Clip not found or expired" }),
                { status: 404, headers: corsHeaders }
            );
        }
        return new Response(JSON.stringify(result), { headers: corsHeaders });
    } else if (pathname === "/user/clips" && request.method === "GET" && user_id) {
        const results = await clip.getUserClips(user_id);
        return new Response(
            JSON.stringify({ clips: results }),
            { headers: corsHeaders }
        );
    }

    return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: corsHeaders }
    );
}