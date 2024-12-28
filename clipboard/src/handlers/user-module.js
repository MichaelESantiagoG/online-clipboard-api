import { corsHeaders } from '../utils/cors.js';

export class User {
    constructor(database) {
        this.db = database;
    }

    // Utility function to hash password
    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    async createUser(username, password) {
        // Validate input
        if (!username || username.length < 3) {
            throw new Error("Username must be at least 3 characters long");
        }
        if (!password || password.length < 8) {
            throw new Error("Password must be at least 8 characters long");
        }

        const user_id = Math.random().toString(36).substring(2, 8);
        const hashedPassword = await this.hashPassword(password);

        // Check if username already exists
        const checkStmt = this.db.prepare("SELECT username FROM users WHERE username = ?");
        const { results } = await checkStmt.bind(username).all();
        if (results.length > 0) {
            throw new Error("Username already exists");
        }

        const stmt = this.db.prepare(
            "INSERT INTO users (user_id, username, password, created_at) VALUES (?, ?, ?, datetime('now'))"
        );

        await stmt.bind(user_id, username, hashedPassword).run();
        return user_id;
    }

    async verifyUser(username, password) {
        const hashedPassword = await this.hashPassword(password);
        const stmt = this.db.prepare(
            "SELECT user_id FROM users WHERE username = ? AND password = ?"
        );
        const { results } = await stmt.bind(username, hashedPassword).all();
        return results.length > 0 ? results[0] : null;
    }

    async getUser(user_id) {
        const stmt = this.db.prepare(
            "SELECT user_id, username, created_at FROM users WHERE user_id = ?"
        );
        const { results } = await stmt.bind(user_id).all();
        return results.length > 0 ? results[0] : null;
    }
}

export async function handleUserEndpoint(request, database) {
    const user = new User(database);
    const url = new URL(request.url);
    const pathname = url.pathname;
    const user_id = url.searchParams.get("id");

    if (pathname === "/user" && request.method === "POST") {
        try {
            const { username, password } = await request.json();
            if (!username || !password) {
                return new Response(
                    JSON.stringify({ error: "Username and password are required" }),
                    { status: 400, headers: corsHeaders }
                );
            }
            const newUserId = await user.createUser(username, password);
            return new Response(
                JSON.stringify({ user_id: newUserId }),
                { headers: corsHeaders }
            );
        } catch (error) {
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 400, headers: corsHeaders }
            );
        }
    } else if (pathname === "/login" && request.method === "POST") {
        try {
            const { username, password } = await request.json();
            if (!username || !password) {
                return new Response(
                    JSON.stringify({ error: "Username and password are required" }),
                    { status: 400, headers: corsHeaders }
                );
            }
            const userInfo = await user.verifyUser(username, password);
            if (!userInfo) {
                return new Response(
                    JSON.stringify({ error: "Invalid credentials" }),
                    { status: 401, headers: corsHeaders }
                );
            }
            return new Response(JSON.stringify(userInfo), { headers: corsHeaders });
        } catch (error) {
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: corsHeaders }
            );
        }
    } else if (pathname === "/user" && request.method === "GET" && user_id) {
        const result = await user.getUser(user_id);
        if (!result) {
            return new Response(
                JSON.stringify({ error: "User not found" }),
                { status: 404, headers: corsHeaders }
            );
        }
        return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: corsHeaders }
    );
}