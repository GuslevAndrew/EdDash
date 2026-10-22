// Set EDDASH_PAUSED=false when the database and public site are ready to return.
export const isProjectPaused = process.env.EDDASH_PAUSED !== "false";
