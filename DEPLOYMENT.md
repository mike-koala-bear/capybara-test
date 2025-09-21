# 🚀 Capybara Game Deployment Guide

This guide will help you deploy your Capybara word guessing game with achievements system to production using various hosting platforms.

## 📋 Prerequisites

- Git repository (GitHub, GitLab, etc.)
- Choose your deployment platforms:
  - **Backend**: Render, Heroku, DigitalOcean, AWS, or any Docker-compatible platform
  - **Frontend**: Vercel, Netlify, or any static hosting platform

## 🔧 Environment Variables

### Backend Environment Variables
Create these environment variables in your backend deployment platform:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database
# Or for SQLite (development): sqlite:///./capybara.db

# Security
SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
AUTH_SECRET=your-nextauth-secret-key

# CORS (adjust for your frontend domain)
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

### Frontend Environment Variables
Create these environment variables in your frontend deployment platform:

```env
# NextAuth Configuration
NEXTAUTH_URL=https://your-frontend-domain.vercel.app
NEXTAUTH_SECRET=your-nextauth-secret-key

# API Configuration
NEXT_PUBLIC_API_BASE=https://your-backend-domain.render.com
# Or: https://your-app.herokuapp.com (for Heroku)
# Or: https://your-app.ondigitalocean.app (for DigitalOcean)

# Development fallbacks (already configured in next.config.mjs)
```

## 🖥️ Backend Deployment Options

### Option 1: Render (Recommended - Free Tier Available)

1. **Connect Repository**
   - Go to [Render](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Set root directory to `backend`

2. **Configure Build Settings**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Environment: `Python 3`

3. **Add Environment Variables**
   - Add all backend environment variables listed above
   - Render provides free PostgreSQL database

### Option 2: Heroku

1. **Install Heroku CLI and login**
   ```bash
   heroku login
   cd backend
   ```

2. **Create Heroku app**
   ```bash
   heroku create your-capybara-backend
   heroku addons:create heroku-postgresql:mini
   ```

3. **Configure for Heroku**
   Create `Procfile` in backend directory:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

4. **Deploy**
   ```bash
   git subtree push --prefix backend heroku main
   ```

### Option 3: DigitalOcean App Platform

1. **Connect Repository**
   - Go to DigitalOcean Apps
   - Create new app from GitHub
   - Select your repository and `backend` folder

2. **Configure App**
   - Type: Web Service
   - Source Directory: `/backend`
   - Build Command: `pip install -r requirements.txt`
   - Run Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Option 4: Docker Deployment (Any Platform)

```bash
# Build and test locally
cd backend
docker build -t capybara-backend .
docker run -p 8000:8000 -e DATABASE_URL="your-db-url" capybara-backend

# Deploy to any Docker-compatible platform
# (AWS ECS, Google Cloud Run, Azure Container Instances, etc.)
```

## 🌐 Frontend Deployment Options

### Option 1: Vercel (Recommended - Free Tier Available)

1. **Connect Repository**
   - Go to [Vercel](https://vercel.com)
   - Click "New Project" → Import from GitHub
   - Select your repository
   - Set root directory to `frontend`

2. **Configure Build Settings**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

3. **Configure Environment Variables**
   - In Vercel dashboard, go to your project
   - Click "Settings" → "Environment Variables"
   - Add all frontend environment variables listed above

### Option 2: Netlify

1. **Connect Repository**
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository
   - Set base directory to `frontend`

2. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `out`
   - Add to `next.config.mjs`: `output: 'export'` for static export

3. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add all frontend environment variables

### Option 3: GitHub Pages (Static Export)

1. **Configure for Static Export**
   Update `next.config.mjs`:
   ```javascript
   const nextConfig = {
     output: 'export',
     trailingSlash: true,
     images: { unoptimized: true }
   };
   ```

2. **Build and Deploy**
   ```bash
   cd frontend
   npm run build
   # Deploy the 'out' folder to GitHub Pages
   ```

### Option 4: Docker Deployment

```bash
# Build and test locally
cd frontend
docker build -t capybara-frontend .
docker run -p 3000:3000 capybara-frontend
```

## 🗄️ Database Migration

The application will automatically create tables on first run. For production:

1. **PostgreSQL (Recommended)**
   - Use your platform's PostgreSQL addon (Render, Heroku, etc.)
   - Set DATABASE_URL environment variable
   - Tables will be created automatically

2. **SQLite (Development Only)**
   - Default for local development
   - Not recommended for production

## 🔒 Security Checklist

- [ ] Change all default secret keys
- [ ] Use strong, unique passwords
- [ ] Enable HTTPS for both frontend and backend
- [ ] Configure CORS properly for your domain
- [ ] Use environment variables for all secrets
- [ ] Enable database backups

## 🌐 Custom Domain Setup

### Backend (Railway)
1. Go to your Railway service
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

### Frontend (Vercel)
1. Go to your Vercel project
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

## 🧪 Testing Deployment

1. **Backend Health Check**
   ```bash
   curl https://your-backend-domain.railway.app/
   ```

2. **Frontend Access**
   - Visit your frontend URL
   - Test user registration/login
   - Play a game and check achievements
   - Verify scores are saved

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check FRONTEND_URL environment variable
   - Verify allow_origins in main.py

2. **Database Connection Issues**
   - Verify DATABASE_URL format
   - Check database service is running
   - Ensure network connectivity

3. **Authentication Issues**
   - Verify SECRET_KEY and AUTH_SECRET match
   - Check NEXTAUTH_URL is correct
   - Ensure API_BASE URL is accessible

4. **Build Failures**
   - Check all dependencies in requirements.txt
   - Verify Node.js version compatibility
   - Check for missing environment variables

## 📊 Monitoring

- Monitor Railway logs for backend issues
- Monitor Vercel logs for frontend issues
- Set up uptime monitoring
- Monitor database performance

## 🔄 Updates

To update your deployment:

1. **Backend**: Push to main branch (auto-deploys on Railway)
2. **Frontend**: Push to main branch (auto-deploys on Vercel)
3. **Database**: Migrations run automatically

## 📞 Support

If you encounter issues:
1. Check the logs in your deployment platform
2. Verify all environment variables are set
3. Test locally first to isolate the issue
4. Check the troubleshooting section above

---

🦫 **Happy Gaming!** Your Capybara word guessing game with achievements is ready for the world!
