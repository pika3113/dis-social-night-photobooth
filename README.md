# Photobooth Web Application 📸

A simple photobooth web application that allows users to upload photos and receive QR codes for easy downloading.

## Features

- 📤 **Photo Upload**: Upload photos via click or drag-and-drop
- 🔲 **QR Code Generation**: Automatically generates QR codes for each uploaded photo
- 📱 **Mobile-Friendly**: Works on any device with a web browser
- ⬇️ **Easy Download**: Scan QR code or use direct link to download photos
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Upload a Photo

1. Go to the main page (`http://localhost:3000`)
2. Click the upload area or drag and drop an image file
3. Click "Upload Photo"
4. A QR code will be generated automatically

### Download a Photo

1. Scan the QR code with your phone
2. Or open the download link in any browser
3. Click "Download Photo" to save the image

## API Endpoints

- `POST /api/upload` - Upload a photo (multipart/form-data)
- `GET /api/photo/:photoId` - Get photo metadata
- `GET /api/download/:photoId` - Download photo file
- `GET /download/:photoId` - Download page

## File Structure

```
photobooth-webapp/
├── server.js           # Express server and API endpoints
├── package.json        # Project dependencies
├── public/
│   ├── index.html     # Upload interface
│   └── download.html  # Download page
└── uploads/           # Uploaded photos storage (auto-created)
```

## Future Enhancements

- 🎥 Add camera integration for live photo capture
- 💾 Database integration for persistent storage
- ☁️ Cloud storage (AWS S3, Cloudinary, etc.)
- 🖼️ Photo filters and editing
- 📊 Admin dashboard for photo management
- ⏰ Auto-delete photos after X hours/days

## Technologies Used

- **Backend**: Node.js, Express
- **File Upload**: Multer
- **Cloud Storage**: Cloudinary
- **QR Code Generation**: qrcode
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Deployment**: Vercel (serverless)

## Deployment

This app is designed to run on Vercel's hobby plan. Photos are stored in Cloudinary (free tier).

**Quick Deploy:**
1. Sign up for [Cloudinary](https://cloudinary.com) (free)
2. Get your credentials from the Cloudinary dashboard
3. Deploy to Vercel
4. Add environment variables in Vercel settings
5. Done!

## License

ISC
