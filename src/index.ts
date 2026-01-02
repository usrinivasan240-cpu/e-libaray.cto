import fs from 'fs';
import path from 'path';
import { createApp } from './app.js';
import { env } from './config.js';

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('Created uploads directory');
    } catch (error) {
        console.error('Failed to create uploads directory:', error);
    }
}

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`E-Library API running on http://localhost:${env.PORT}`);
});
