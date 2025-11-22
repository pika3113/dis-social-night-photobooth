const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, uniqueId + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept only image files with specific MIME types
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Store photo metadata (in production, use a database)
// WARNING: This in-memory storage will be lost when the server restarts.
// For production use, implement proper persistence with a database (e.g., MongoDB, PostgreSQL)
const photoMetadata = {};

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Serve static files
app.use(express.static('public'));
app.use('/uploads', express.static(uploadsDir));

// Upload endpoint
app.post('/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const photoId = path.parse(req.file.filename).name;
        const photoUrl = `${req.protocol}://${req.get('host')}/photo/${photoId}`;
        
        // Store metadata
        photoMetadata[photoId] = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            uploadDate: new Date().toISOString(),
            size: req.file.size,
            mimetype: req.file.mimetype
        };

        // Generate QR code
        const qrCodeDataUrl = await QRCode.toDataURL(photoUrl, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.json({
            success: true,
            photoId: photoId,
            photoUrl: photoUrl,
            qrCode: qrCodeDataUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload photo' });
    }
});

// Photo view page
app.get('/photo/:id', (req, res) => {
    const photoId = req.params.id;
    const metadata = photoMetadata[photoId];

    if (!metadata) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Photo Not Found - DIS Social Night</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        padding: 40px;
                        text-align: center;
                        max-width: 500px;
                    }
                    h1 { color: #333; margin-bottom: 20px; }
                    p { color: #666; font-size: 1.1em; margin-bottom: 30px; }
                    a {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 15px 40px;
                        border-radius: 50px;
                        text-decoration: none;
                        font-weight: 600;
                        display: inline-block;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📸 Photo Not Available</h1>
                    <p>The photo you're looking for is not available or may have been removed.</p>
                    <a href="/">Upload a New Photo</a>
                </div>
            </body>
            </html>
        `);
    }

    const photoPath = `/uploads/${metadata.filename}`;
    
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Photo - DIS Social Night</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .container {
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    padding: 40px;
                    max-width: 800px;
                    width: 100%;
                }
                h1 {
                    color: #333;
                    margin-bottom: 10px;
                    font-size: 2em;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 30px;
                    font-size: 1.1em;
                }
                .photo-container {
                    margin: 30px 0;
                    text-align: center;
                }
                .photo-container img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                }
                .info {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .info p {
                    margin: 5px 0;
                    color: #555;
                }
                .download-btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 40px;
                    border: none;
                    border-radius: 50px;
                    font-size: 1.1em;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                .download-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                }
                @media (max-width: 600px) {
                    .container {
                        padding: 20px;
                    }
                    h1 {
                        font-size: 1.5em;
                    }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📸 Your Photo</h1>
                <p class="subtitle">DIS Social Night Photobooth</p>
                
                <div class="photo-container">
                    <img src="${photoPath}" alt="Your photo">
                </div>
                
                <div class="info">
                    <p><strong>Original filename:</strong> ${escapeHtml(metadata.originalName)}</p>
                    <p><strong>Upload date:</strong> ${escapeHtml(new Date(metadata.uploadDate).toLocaleString())}</p>
                </div>
                
                <div style="text-align: center;">
                    <a href="${photoPath}" download="${escapeHtml(metadata.originalName)}" class="download-btn">
                        📥 Download Photo
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', photos: Object.keys(photoMetadata).length });
});

app.listen(PORT, () => {
    console.log(`Photobooth server running on http://localhost:${PORT}`);
});
