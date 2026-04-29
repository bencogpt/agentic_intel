// server.js — Local development entry point. Not used in Firebase deployment.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
// .env.local holds PORT and GOOGLE_APPLICATION_CREDENTIALS (local-only, git-ignored)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

const createApp = require('./app');
const app = createApp();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AVAR backend running on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('WARNING: ANTHROPIC_API_KEY is not set');
  if (!process.env.TAVILY_API_KEY)    console.warn('WARNING: TAVILY_API_KEY is not set');
  if (!process.env.JWT_SECRET)        console.warn('WARNING: JWT_SECRET is not set — auth will not work');
  if (!process.env.ADMIN_PASSWORD)    console.warn('WARNING: ADMIN_PASSWORD is not set — admin login disabled');
});
