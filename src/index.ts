import fs from 'fs';
import path from 'path';
import { createApp } from './app.js';
import { env } from './config.js';

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`E-Library API running on http://localhost:${env.PORT}`);
});
