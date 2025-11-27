# Deploying to Vercel

This guide will help you deploy the photobooth app to Vercel with Cloudinary for photo storage.

## Step 1: Set up Cloudinary (Free)

1. Go to [cloudinary.com](https://cloudinary.com/) and sign up for a free account
2. After signing in, go to your [Dashboard](https://cloudinary.com/console)
3. Copy these three values:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Add environment variables when prompted, or add them later in the Vercel dashboard

### Option B: Deploy via GitHub + Vercel Dashboard

1. Push your code to GitHub:
```bash
git add .
git commit -m "Initial commit"
git push
```

2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project"
4. Import your GitHub repository
5. Vercel will auto-detect the settings
6. Click "Deploy"

## Step 3: Add Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add these three variables:
   - `CLOUDINARY_CLOUD_NAME` = your cloud name
   - `CLOUDINARY_API_KEY` = your api key
   - `CLOUDINARY_API_SECRET` = your api secret
3. Click "Save"
4. Redeploy your project (Vercel → Deployments → ⋯ → Redeploy)

## Step 4: Test Your App

1. Visit your Vercel URL (e.g., `your-app.vercel.app`)
2. Upload a test photo
3. Scan the QR code or open the download link
4. Verify the photo loads and downloads correctly

## Important Notes

### Photo Metadata Storage

⚠️ **Current limitation**: Photo metadata is stored in memory and will be lost when the serverless function restarts.

For production, you should use a database. Here are options:

**Free Database Options:**
- **Vercel Postgres** (Built-in, easy setup)
- **MongoDB Atlas** (500MB free)
- **Supabase** (500MB free, PostgreSQL)
- **PlanetScale** (5GB free, MySQL)

### Cloudinary Limits (Free Tier)

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month

This is plenty for a photobooth at events!

## Troubleshooting

### "Photo not found" errors
- The metadata is lost when serverless functions restart
- Solution: Add a database (see above)

### Upload fails
- Check your Cloudinary credentials in Vercel environment variables
- Make sure all three variables are set correctly

### QR code doesn't work
- Make sure you're using the production URL, not localhost
- Check that the photo was actually uploaded to Cloudinary

## Next Steps

Consider adding:
- Database for persistent storage (Vercel Postgres is easiest)
- Photo expiration (auto-delete after 24 hours)
- Custom domain
- Analytics to track usage
