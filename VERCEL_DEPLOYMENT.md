# Vercel Deployment Guide

This guide explains how to deploy the E-Library API to Vercel and understand why the initial deployment failed.

## 🚨 What Was Wrong (The Root Cause)

### Traditional Server vs Serverless Functions

**Your Original Code (Traditional Express Server):**
```typescript
// src/index.ts
const app = createApp();
app.listen(env.PORT, () => {
  console.log(`E-Library API running on http://localhost:${env.PORT}`);
});
```

This code:
1. Starts a persistent Node.js process
2. Opens a TCP socket on port 3000
3. Keeps the process alive indefinitely
4. Listens for incoming connections

**Vercel's Serverless Model:**
- Vercel spawns a new function instance for each HTTP request
- Each instance handles ONE request and then terminates
- Vercel manages the HTTP server infrastructure
- Your code should ONLY handle request/response logic, NOT start a server

**The Crash:**
When Vercel tried to run `app.listen()`, it caused a runtime crash because:
1. Vercel already has a server listening for connections
2. Your code tried to start ANOTHER server on the same port
3. This violated Vercel's infrastructure model
4. Result: `FUNCTION_INVOCATION_FAILED`

## ✅ The Fix

### 1. Serverless Entry Point (`api/index.ts`)

```typescript
import { createApp } from '../dist/app.js';

const app = createApp();

// Export the app as a Vercel serverless function
// Vercel will handle the server, your app just handles requests
export default app;
```

**Key Points:**
- We import the Express app (not the server)
- We export it as the default export
- We DON'T call `app.listen()`
- Vercel's runtime will invoke this handler for each request

### 2. Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": null,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api/index"
    }
  ]
}
```

**What This Does:**
- Rewrites all requests (`/(.*)`) to the serverless function (`/api/index`)
- This ensures your Express app handles all routes
- Vercel builds the TypeScript code before deploying

### 3. Build Script

Added `vercel-build` script to package.json:
```json
"vercel-build": "npm run build"
```

This runs `tsc` to compile TypeScript to the `dist/` directory.

## 📊 How It Works Now

### Local Development (Still Works!)
```bash
npm run dev  # Uses src/index.ts which calls app.listen()
```

### Vercel Deployment
1. Vercel clones your repo
2. Runs `npm install` (which generates Prisma client)
3. Runs `vercel-build` (compiles TypeScript to `dist/`)
4. Deploys the serverless function in `api/index.ts`
5. For each request:
   - Vercel spawns a function instance
   - Imports your Express app from `dist/app.js`
   - Passes the HTTP request to your app
   - Your app handles it and returns response
   - Instance terminates

## 🔑 Required Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```bash
# Required
JWT_SECRET=your-super-secret-key-min-10-chars

# Required (Database)
DATABASE_URL=file:./prisma/dev.db

# Optional (Payments)
UPI_VPA=library@upi
UPI_PAYEE_NAME=E-Library

# Optional (Google Auth)
GOOGLE_CLIENT_ID=your-google-client-id

# Vercel sets these automatically:
# PORT=3000 (or whatever port Vercel uses)
# NODE_ENV=production
```

**⚠️ Critical:** `JWT_SECRET` must be set and be at least 10 characters long, otherwise the app will crash on startup.

## 🎯 Serverless Mental Model

### Traditional Server
```
[Your Server] → [Persistent Process] → [Listens Forever]
     ↓
[Request 1] → Handled
[Request 2] → Handled
[Request 3] → Handled
...
```

### Serverless Function
```
[Request 1] → [Spawn Instance] → [Handle] → [Terminate]
[Request 2] → [Spawn Instance] → [Handle] → [Terminate]
[Request 3] → [Spawn Instance] → [Handle] → [Terminate]
```

**Key Differences:**
1. **No persistent state** - Each request gets a fresh instance
2. **No long-lived connections** - WebSockets need special handling
3. **Cold starts** - First request may be slower (instance boot time)
4. **Auto-scaling** - Vercel spawns more instances automatically
5. **No need to manage ports** - Vercel handles this

## ⚠️ Warning Signs & Code Smells

### Things That Cause FUNCTION_INVOCATION_FAILED:

1. **Calling `app.listen()`** ❌
   ```typescript
   app.listen(3000);  // Will crash on Vercel
   ```

2. **Starting a background process** ❌
   ```typescript
   setInterval(() => { ... }, 1000);  // May cause issues
   ```

3. **Opening persistent connections without cleanup** ❌
   ```typescript
   // Database connections should be managed carefully
   const connection = await createConnection();  // Should close after request
   ```

4. **Writing to disk in serverless** ❌
   ```typescript
   fs.writeFileSync('/tmp/file.txt', data);  // Use /tmp only
   ```

5. **Unhandled promise rejections** ❌
   ```typescript
   async function handler() {
     // No try/catch, no .catch() - will crash
     await someAsyncOperation();
   }
   ```

### Correct Patterns:

1. **Export the app** ✅
   ```typescript
   export default app;
   ```

2. **Use try/catch for async operations** ✅
   ```typescript
   async function handler(req, res) {
     try {
       const result = await someAsyncOperation();
       res.json(result);
     } catch (error) {
       console.error(error);
       res.status(500).json({ error: 'Internal server error' });
     }
   }
   ```

3. **Clean up resources** ✅
   ```typescript
   // Prisma connection is managed globally (good for serverless)
   import { prisma } from '../db.js';
   ```

## 🔄 Alternatives Comparison

### Option 1: Vercel Serverless (Current Fix)

**Pros:**
- Free tier available
- Automatic scaling
- Global CDN
- Easy deployment (git push)
- No server management

**Cons:**
- Cold starts (first request slower)
- Execution time limits (10-60 seconds)
- Memory limits
- No persistent processes
- SQLite limitations (file-based DB isn't ideal)

**Best for:** Small to medium APIs, low to medium traffic, academic projects

### Option 2: Render / Railway (Traditional Server)

**Pros:**
- Runs full Express server (`app.listen()` works)
- No cold starts
- Longer execution times
- Persistent processes allowed
- Better for SQLite

**Cons:**
- Must manage server lifecycle
- No automatic scaling (free tier)
- Limited free tier
- Manual scaling needed

**Best for:** High traffic apps, need persistent processes, WebSocket support

### Option 3: Vercel + PostgreSQL (Better for Vercel)

**Pros:**
- Best of Vercel serverless
- Proper database for serverless
- Scalable

**Cons:**
- Requires migration from SQLite
- Adds complexity
- Database costs

**Best for:** Production apps on Vercel

## 🎓 Why This Matters for Academic Projects

For an E-Library project, here's my recommendation:

**Current Setup (Vercel + SQLite):**
- ✅ Good for development and demos
- ✅ Free tier available
- ⚠️ SQLite has limitations in serverless (file I/O)
- ⚠️ Cold starts may affect user experience

**For Production/Larger Scale:**
- Switch to Vercel PostgreSQL or Supabase
- Keep Vercel serverless functions
- Better performance and reliability

**For Simplicity (If you want traditional server):**
- Deploy to Render or Railway
- Keep your current code (no changes needed)
- Better for SQLite

## 🚀 Deployment Steps

1. **Push your changes to Git**
   ```bash
   git add .
   git commit -m "Fix Vercel deployment - add serverless entry point"
   git push
   ```

2. **Deploy to Vercel**
   - Go to vercel.com
   - Import your repository
   - Vercel will auto-detect the configuration

3. **Set Environment Variables**
   - Go to your project settings
   - Add `JWT_SECRET` (required!)
   - Add other optional variables as needed

4. **Deploy**
   - Vercel will build and deploy automatically
   - Check the deployment logs for any errors

## 🧪 Testing

After deployment, test:
```bash
# Health check
curl https://your-app.vercel.app/api/health

# Should return: {"ok":true}
```

## 📚 Key Takeaways

1. **Serverless ≠ Traditional Server** - Different mental models
2. **Export, Don't Listen** - Never call `app.listen()` on Vercel
3. **Environment Variables Matter** - `JWT_SECRET` is required
4. **Handle Async Errors** - Always use try/catch or .catch()
5. **Choose the Right Tool** - Vercel for serverless, Render/Railway for traditional servers
