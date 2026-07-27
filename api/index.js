// Vercel serverless entry point. All /api/* requests are rewritten here
// (see vercel.json) and handled by the same Express app used locally and
// on Fly.io — Express apps are valid (req, res) handlers, so no adapter
// is needed, and Vercel's runtime calls this instead of app.listen().
import { app } from '../server/app.js';

export default app;
