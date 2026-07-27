// Local dev and Fly.io entry point — actually binds and listens. Vercel uses
// api/index.js instead, which imports the same app but never calls listen()
// (Vercel's runtime handles that itself).
import { app } from './app.js';

// Deliberately not PORT: some dev launchers inject PORT for the web server.
const PORT = process.env.API_PORT || process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`sql-leetcode api  →  http://localhost:${PORT}`);
});
