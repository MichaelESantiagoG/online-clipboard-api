import { handleClipEndpoint } from './handlers/clipboard-module.js';
import { handleUserEndpoint } from './handlers/user-module.js';
import { CleanupService } from './handlers/clip-cleanup.js';
import { corsHeaders } from './utils/cors.js';

// Main worker handler
export default {
	async fetch(request, env) {
		const { DATABASE } = env;
		const url = new URL(request.url);
		const pathname = url.pathname;

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			// Route requests based on pathname
			switch (pathname) {
				case "/clip":
					return await handleClipEndpoint(request, DATABASE);
				case "/user":
					return await handleUserEndpoint(request, DATABASE);
				case "/user/clips":
					return await handleClipEndpoint(request, DATABASE);
				case "/login":
					return await handleUserEndpoint(request, DATABASE);
					default:
					return new Response(
						JSON.stringify({ error: "Endpoint not found" }),
						{ status: 404, headers: corsHeaders }
					);
			}
		} catch (error) {
			return new Response(
				JSON.stringify({ error: "Internal server error", details: error.message }),
				{ status: 500, headers: corsHeaders }
			);
		}
	},

	// Add the scheduled function as part of the default export
	async scheduled(event, env, ctx) {
		const cleanup = new CleanupService(env.DATABASE);

		try {
			const result = await cleanup.cleanupExpiredClips();
			console.log('Cleanup completed:', result);
			
			// Return the number of deleted clips
			const deletedCount = result.changes;
			console.log(`Deleted ${deletedCount} expired clips`);

			return new Response(
				JSON.stringify({ success: true, deletedClips: deletedCount }), 
				{ status: 200 }
			);
		} catch (error) {
			console.error('Cleanup failed:', error);
			return new Response(
				JSON.stringify({ error: 'Cleanup failed', message: error.message }), 
				{ status: 500 }
			);
		}
	}
};