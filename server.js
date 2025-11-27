require('dotenv').config();
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for memory storage (Vercel-friendly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Store photo metadata (in production, use a database like MongoDB/PostgreSQL)
const photosDatabase = {};
let photoCounter = 1;

// Generate short ID (base36 for max efficiency)
function generateShortId() {
  const id = photoCounter.toString(36).padStart(4, '0');
  photoCounter++;
  return id;
}

// Upload multiple photos endpoint
app.post('/api/upload', upload.array('photos', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const sessionId = generateShortId();
    const isSinglePhoto = req.files.length === 1;
    
    // Upload all files to Cloudinary
    const uploadPromises = req.files.map((file, index) => {
      const photoId = isSinglePhoto ? sessionId : `${sessionId}_${index + 1}`;
      
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: `dis social night 2025/${sessionId}`,
            public_id: photoId,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve({ photoId, result });
          }
        );
        uploadStream.end(file.buffer);
      });
    });

    const uploads = await Promise.all(uploadPromises);
    console.log(`✅ Uploaded ${uploads.length} photo(s) to Cloudinary`);

    // For single photo: link directly to image
    // For multiple: link to folder/session
    const shortUrl = isSinglePhoto 
      ? `${req.protocol}://${req.get('host')}/${sessionId}`
      : `${req.protocol}://${req.get('host')}/${sessionId}`;
    
    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl);
    
    // Store session metadata
    photosDatabase[sessionId] = {
      photos: uploads.map(u => ({
        cloudinaryUrl: u.result.secure_url,
        cloudinaryPublicId: u.result.public_id,
        photoId: u.photoId
      })),
      isSinglePhoto,
      uploadDate: new Date()
    };

    res.json({
      success: true,
      sessionId: sessionId,
      qrCode: qrCodeDataUrl,
      downloadUrl: shortUrl,
      photoCount: uploads.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

// Get photo info endpoint
app.get('/api/photo/:photoId', async (req, res) => {
  const { photoId } = req.params;
  
  try {
    // Fetch directly from Cloudinary
    const result = await cloudinary.api.resource(`dis social night 2025/${photoId}`);
    
    console.log('📷 Fetched from Cloudinary:', result.secure_url);
    
    res.json({
      photoId: photoId,
      cloudinaryUrl: result.secure_url,
      uploadDate: result.created_at,
      downloadUrl: `${req.protocol}://${req.get('host')}/download/${photoId}`
    });
  } catch (error) {
    console.error('❌ Cloudinary fetch error:', error);
    return res.status(404).json({ error: 'Photo not found' });
  }
});

// Short URL redirect
app.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  // Skip if it's a file request
  if (sessionId.includes('.')) {
    return res.status(404).send('Not found');
  }
  
  try {
    // Try memory first
    if (photosDatabase[sessionId]) {
      const session = photosDatabase[sessionId];
      
      // Single photo: redirect directly to image
      if (session.isSinglePhoto) {
        return res.redirect(session.photos[0].cloudinaryUrl);
      }
      
      // Multiple photos: show gallery page
      return res.send(generateGalleryPage(session, sessionId));
    }
    
    // Fallback: try to fetch from Cloudinary
    try {
      const result = await cloudinary.api.resource(`dis social night 2025/${sessionId}/${sessionId}`);
      return res.redirect(result.secure_url);
    } catch {
      // Try as folder
      const folder = await cloudinary.api.resources({
        type: 'upload',
        prefix: `dis social night 2025/${sessionId}/`,
        max_results: 50
      });
      
      if (folder.resources.length === 1) {
        return res.redirect(folder.resources[0].secure_url);
      }
      
      return res.send(generateGalleryPage({ photos: folder.resources }, sessionId));
    }
  } catch (error) {
    console.error('Session not found:', error);
    res.status(404).send('Photos not found');
  }
});

// Generate simple gallery page for multiple photos
function generateGalleryPage(session, sessionId) {
  const photos = session.photos || session;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Gallery</title>
  <style>
    body { 
      margin: 0; 
      padding: 20px; 
      background: #1a1a1a; 
      font-family: Arial, sans-serif;
    }
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
    }
    h1 { 
      color: white; 
      text-align: center; 
      margin-bottom: 30px; 
    }
    .gallery { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
      gap: 20px; 
    }
    .photo { 
      position: relative; 
      overflow: hidden; 
      border-radius: 10px; 
      background: #2a2a2a;
    }
    .photo img { 
      width: 100%; 
      height: 100%; 
      object-fit: cover; 
      display: block; 
    }
    .photo a {
      display: block;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📸 Your Photos</h1>
    <div class="gallery">
      ${photos.map((photo) => `
        <div class="photo">
          <a href="${photo.cloudinaryUrl || photo.secure_url}" target="_blank">
            <img src="${photo.cloudinaryUrl || photo.secure_url}" alt="Photo" loading="lazy">
          </a>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;
}

// Start server only if not in Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Photobooth server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
