# DIS Social Night - Photobooth Web Application

A web-based photobooth application that allows users to upload photos, stores them on the server, and generates QR codes for easy sharing and downloading.

## Features

- 📤 **Photo Upload**: Upload photos from your computer with drag-and-drop support
- 🖼️ **Preview**: Preview your photo before uploading
- 📱 **QR Code Generation**: Automatically generates QR codes for each uploaded photo
- 🔗 **Direct Links**: Get shareable links to view and download photos
- 📥 **Download**: Easy download functionality for all photos
- 🎨 **Responsive Design**: Works seamlessly on desktop and mobile devices
- ✨ **Modern UI**: Clean, intuitive interface with gradient design

## Technology Stack

- **Backend**: Node.js + Express.js
- **File Upload**: Multer
- **QR Code Generation**: qrcode library
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: Local file system (uploads directory)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/pika3113/dis-social-night-photobooth.git
cd dis-social-night-photobooth
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Uploading a Photo

1. Open the application in your web browser
2. Click "Choose Photo" or drag and drop an image onto the upload area
3. Preview your photo
4. Click "Upload Photo" to upload
5. Wait for the upload to complete

### Sharing Your Photo

After upload, you'll receive:
- A QR code that can be scanned with any smartphone
- A direct link that can be copied and shared
- A "View Photo" button to see your photo immediately

### Viewing and Downloading Photos

1. Scan the QR code with a smartphone camera or QR code reader
2. Or visit the direct link in any browser
3. Click the "Download Photo" button to save it to your device

## File Structure

```
dis-social-night-photobooth/
├── public/                 # Frontend files
│   ├── index.html         # Main page
│   ├── styles.css         # Styling
│   └── script.js          # Client-side JavaScript
├── uploads/               # Uploaded photos (created automatically)
├── server.js              # Express server
├── package.json           # Dependencies
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## Supported File Formats

- JPEG/JPG
- PNG
- GIF
- WebP
- All standard image formats

Maximum file size: 10MB

## API Endpoints

### POST /upload
Upload a photo file

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: form field "photo" with the image file

**Response:**
```json
{
  "success": true,
  "photoId": "unique-photo-id",
  "photoUrl": "http://localhost:3000/photo/unique-photo-id",
  "qrCode": "data:image/png;base64,...",
  "filename": "unique-photo-id.jpg"
}
```

### GET /photo/:id
View and download a specific photo

Returns an HTML page with the photo display and download functionality.

### GET /health
Health check endpoint

Returns:
```json
{
  "status": "ok",
  "photos": 5
}
```

## Future Enhancements

- 📷 Direct camera integration (when hardware is available)
- 🗄️ Database integration for metadata storage
- 🎨 Customizable branding and themes
- 📊 Photo gallery/session management
- 🔐 Password protection for photo access
- ☁️ Cloud storage integration (S3, Cloudinary, etc.)
- 🖨️ Print functionality for QR codes

## Development

### Running in Development Mode

Use nodemon for automatic server restart on file changes:

```bash
npm run dev
```

### Project Dependencies

- **express**: Web framework
- **multer**: File upload handling
- **qrcode**: QR code generation
- **uuid**: Unique ID generation
- **nodemon**: Development auto-reload (dev dependency)

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.

---

Made with ❤️ for DIS Social Night
