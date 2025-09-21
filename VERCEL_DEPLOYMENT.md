# 🚀 Vercel Deployment Guide for Capybara Game

This guide will help you deploy your Capybara word guessing game with achievements system to Vercel.

## 📋 Prerequisites

- GitHub repository with your code
- Vercel account (free tier available)
- PostgreSQL database (we'll use Neon or Supabase for free PostgreSQL)

## 🗄️ Database Setup (First!)

Since Vercel functions are serverless, we need an external database.

### Option 1: Neon (Recommended - Free PostgreSQL)

1. Go to [Neon](https://neon.tech)
2. Create a free account and new project
3. Copy your connection string (looks like: `postgresql://user:pass@host/db?sslmode=require`)
4. Save this for environment variables

### Option 2: Supabase (Alternative)

1. Go to [Supabase](https://supabase.com)
2. Create a new project
3. Go to Settings → Database
4. Copy the connection string
5. Save this for environment variables

## 🖥️ Backend Deployment (Vercel Functions)

### Step 1: Deploy Backend

1. **Create New Vercel Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Set **Root Directory** to `backend`

2. **Configure Environment Variables**
   In Vercel dashboard → Settings → Environment Variables, add:
   ```env
   DATABASE_URL=your-postgresql-connection-string-from-neon-or-supabase
   SECRET_KEY=your-super-secret-jwt-key-make-it-long-and-random
   AUTH_SECRET=your-nextauth-secret-key-change-this-too
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   ```

3. **Deploy**
   - Click "Deploy"
   - Your backend will be available at: `https://your-backend.vercel.app`

### Step 2: Test Backend

Visit `https://your-backend.vercel.app/health` - you should see:
```json
{"status": "healthy", "service": "capybara-backend"}
```

## 🌐 Frontend Deployment

### Step 1: Deploy Frontend

1. **Create New Vercel Project**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository (or create a new one)
   - Set **Root Directory** to `frontend`

2. **Configure Environment Variables**
   In Vercel dashboard → Settings → Environment Variables, add:
   ```env
   NEXTAUTH_URL=https://your-frontend-domain.vercel.app
   NEXTAUTH_SECRET=your-nextauth-secret-key-same-as-backend
   NEXT_PUBLIC_API_BASE=https://your-backend.vercel.app
   ```

3. **Deploy**
   - Click "Deploy"
   - Your frontend will be available at: `https://your-frontend.vercel.app`

## 🔧 Configuration Files Created

The following files have been configured for Vercel:

### Backend Files:
- ✅ `vercel.json` - Vercel deployment configuration
- ✅ `requirements.txt` - Updated with `mangum` for serverless
- ✅ `main.py` - Added Mangum handler for Vercel functions

### Frontend Files:
- ✅ `next.config.mjs` - Configured for deployment

## 🧪 Testing Your Deployment

1. **Test Backend API**
   ```bash
   curl https://your-backend.vercel.app/health
   curl https://your-backend.vercel.app/game/random
   ```

2. **Test Frontend**
   - Visit your frontend URL
   - Register a new account
   - Play a game and check if scores save
   - Verify achievements unlock

## 🔒 Security Notes

- ✅ All secrets are in environment variables
- ✅ CORS is configured for your frontend domain
- ✅ Database uses SSL connection
- ✅ JWT tokens for authentication

## 🚨 Troubleshooting

### Common Issues:

1. **"Internal Server Error" on Backend**
   - Check Vercel Functions logs
   - Verify DATABASE_URL is correct
   - Ensure all environment variables are set

2. **CORS Errors**
   - Check FRONTEND_URL environment variable
   - Verify allow_origins in main.py includes your domain

3. **Database Connection Issues**
   - Verify PostgreSQL connection string
   - Check if database service is running
   - Ensure SSL mode is enabled

4. **Authentication Issues**
   - Verify SECRET_KEY and AUTH_SECRET match between frontend/backend
   - Check NEXTAUTH_URL is your actual frontend domain

## 📊 Monitoring

- View logs in Vercel Dashboard → Functions tab
- Monitor performance in Vercel Analytics
- Set up uptime monitoring for your endpoints

## 🔄 Updates

To update your deployment:
1. Push changes to your GitHub repository
2. Vercel will automatically redeploy both frontend and backend
3. Database migrations run automatically on first request

## 💡 Pro Tips

- Use Vercel's preview deployments for testing
- Set up custom domains in Vercel dashboard
- Enable Vercel Analytics for usage insights
- Use Vercel's edge functions for better performance

---

🦫 **Your Capybara game is now live on Vercel!** 

Backend: `https://your-backend.vercel.app`
Frontend: `https://your-frontend.vercel.app`
