/**
 * Video Database Management
 * Manage video database for multi-platform uploads
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_PATH = path.join(__dirname, 'videos-database.json');

/**
 * Load database from JSON file
 */
export function loadDatabase() {
  try {
    if (fs.existsSync(DATABASE_PATH)) {
      const data = fs.readFileSync(DATABASE_PATH, 'utf8');
      const parsed = JSON.parse(data);
      // Handle both array and object formats
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return parsed.videos || [];
    }
    return [];
  } catch (error) {
    console.error('Error loading database:', error.message);
    return [];
  }
}

/**
 * Save database to JSON file
 */
export function saveDatabase(data) {
  try {
    // Always save as array
    const toSave = Array.isArray(data) ? data : (data.videos || []);
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(toSave, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving database:', error.message);
    return false;
  }
}

/**
 * Returns today's date as YYYY-MM-DD in local timezone
 */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a video matches a given date (YYYY-MM-DD).
 * If date is null, all videos match (no date filter).
 */
function matchesDate(video, date) {
  if (!date) return true;
  if (video.upload_date) return video.upload_date === date;
  if (video.created_at) return video.created_at.startsWith(date);
  return false;
}

/**
 * Get videos ready for Facebook upload
 * @param {string|null} date - YYYY-MM-DD to filter by, or null for all
 */
export function getVideosForFacebook(date = null) {
  const db = loadDatabase();
  if (!db || db.length === 0) return [];

  return db.filter((video) => {
    if (video.status !== 'ready') return false;
    if (video.skip === true) return false;
    if (!matchesDate(video, date)) return false;
    if (video.facebook?.uploaded === true) return false;
    if (!video.file_path || !fs.existsSync(video.file_path)) return false;
    return true;
  });
}

/**
 * Get videos ready for TikTok upload
 * @param {string|null} date - YYYY-MM-DD to filter by, or null for all
 */
export function getVideosForTiktok(date = null) {
  const db = loadDatabase();
  if (!db || db.length === 0) return [];

  return db.filter((video) => {
    if (video.status !== 'ready') return false;
    if (video.skip === true) return false;
    if (!matchesDate(video, date)) return false;
    if (video.tiktok?.uploaded === true) return false;
    if (!video.file_path || !fs.existsSync(video.file_path)) return false;
    return true;
  });
}

/**
 * Get videos ready for Threads upload
 * @param {string|null} date - YYYY-MM-DD to filter by, or null for all
 */
export function getVideosForThreads(date = null) {
  const db = loadDatabase();
  if (!db || db.length === 0) return [];

  return db.filter((video) => {
    if (video.status !== 'ready') return false;
    if (video.skip === true) return false;
    if (!matchesDate(video, date)) return false;
    if (video.threads?.uploaded === true) return false;

    // Allow text-only posts (no video file check needed)
    if (video.type === 'text') return true;

    // For video posts, ensure file exists
    if (!video.file_path || !fs.existsSync(video.file_path)) return false;

    return true;
  });
}

/**
 * Update Facebook upload status
 */
export function updateFacebookStatus(videoId, uploaded, metadata = {}) {
  const db = loadDatabase();
  const video = db.find((v) => v.id === videoId);

  if (video) {
    video.facebook = {
      uploaded: uploaded,
      uploaded_at: uploaded ? new Date().toISOString() : null,
      ...metadata,
    };
    saveDatabase(db);
    return true;
  }
  return false;
}

/**
 * Update TikTok upload status
 */
export function updateTiktokStatus(videoId, uploaded, metadata = {}) {
  const db = loadDatabase();
  const video = db.find((v) => v.id === videoId);

  if (video) {
    video.tiktok = {
      uploaded: uploaded,
      uploaded_at: uploaded ? new Date().toISOString() : null,
      ...metadata,
    };
    saveDatabase(db);
    return true;
  }
  return false;
}

/**
 * Update Threads upload status
 */
export function updateThreadsStatus(videoId, uploaded, metadata = {}) {
  const db = loadDatabase();
  const video = db.find((v) => v.id === videoId);

  if (video) {
    video.threads = {
      uploaded: uploaded,
      uploaded_at: uploaded ? new Date().toISOString() : null,
      ...metadata,
    };
    saveDatabase(db);
    return true;
  }
  return false;
}

/**
 * Add or update a video in database
 */
export function upsertVideo(video) {
  const db = loadDatabase();
  const existingIndex = db.findIndex((v) => v.id === video.id);

  if (existingIndex >= 0) {
    db[existingIndex] = { ...db[existingIndex], ...video };
  } else {
    db.push(video);
  }

  saveDatabase(db);
  return true;
}

/**
 * Get database statistics
 */
export function getStatistics() {
  const db = loadDatabase();

  return {
    total: db.length,
    ready: db.filter((v) => v.status === 'ready').length,
    facebook_uploaded: db.filter((v) => v.facebook?.uploaded === true).length,
    tiktok_uploaded: db.filter((v) => v.tiktok?.uploaded === true).length,
    threads_uploaded: db.filter((v) => v.threads?.uploaded === true).length,
    facebook_pending: db.filter((v) => v.status === 'ready' && v.facebook?.uploaded !== true).length,
    tiktok_pending: db.filter((v) => v.status === 'ready' && v.tiktok?.uploaded !== true).length,
    threads_pending: db.filter((v) => v.status === 'ready' && v.threads?.uploaded !== true).length,
  };
}
