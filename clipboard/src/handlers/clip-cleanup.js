export class CleanupService {
    constructor(database) {
        this.db = database;
    }

    async cleanupExpiredClips() {
        // Use strftime to compare timestamps in seconds
        const stmt = this.db.prepare(`
            DELETE FROM clip 
            WHERE strftime('%s', expires_at) < strftime('%s', 'now')
        `);

        try {
            const result = await stmt.run();
            console.log(`Cleaned up ${result.changes} expired clips`);
            return result;
        } catch (error) {
            console.error('Error cleaning up expired clips:', error);
            throw error;
        }
    }

    // Optional: Method to get count of expired clips before cleanup
    async getExpiredClipsCount() {
        const stmt = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM clip 
            WHERE strftime('%s', expires_at) < strftime('%s', 'now')
        `);

        try {
            const result = await stmt.first();
            return result.count;
        } catch (error) {
            console.error('Error counting expired clips:', error);
            throw error;
        }
    }
}