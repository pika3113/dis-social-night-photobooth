# 📸 Sony a7IV Photobooth Setup

This guide explains how to connect your Sony a7IV to the photobooth web app for automatic uploads and QR code generation.

## Prerequisites

1.  **Sony Imaging Edge Desktop** (or similar tethering software) installed on your laptop.
    *   Download: [https://support.d-imaging.sony.co.jp/app/imagingedge/en/](https://support.d-imaging.sony.co.jp/app/imagingedge/en/)
2.  **Node.js** installed on your laptop.
3.  **USB-C Cable** to connect camera to laptop.

## Step 1: Camera Setup (Sony a7IV)

1.  Turn on the camera.
2.  Go to **Menu** > **Network** > **Transfer/Remote** > **PC Remote Function**.
3.  Set **PC Remote** to **On**.
4.  Set **PC Remote Connect Method** to **USB**.

## Step 2: Laptop Setup (Imaging Edge)

1.  Connect the camera to the laptop via USB.
2.  Open **Imaging Edge Desktop** and launch the **Remote** application.
3.  It should detect your camera.
4.  In the Remote settings, look for **Save Destination** or **Save to PC**.
5.  Create a folder on your Desktop (e.g., `photobooth-captures`) and set it as the save destination.
    *   *Important*: Ensure the software saves the **JPG** file to this folder.

## Step 3: Run the Watcher Script

1.  Open a terminal/command prompt in this project folder.
2.  Install dependencies (if you haven't already):
    ```bash
    npm install
    ```
3.  Run the watcher script, pointing it to your capture folder and your live website URL:

    ```bash
    # Syntax: node scripts/camera-watcher.js <PATH_TO_CAPTURE_FOLDER> <YOUR_WEBSITE_UPLOAD_URL>
    
    # OPTION 1: If running locally (testing on your laptop)
    # Use this URL: http://localhost:3000/api/upload
    node scripts/camera-watcher.js ~/Desktop/photobooth-captures http://localhost:3000/api/upload
    
    # OPTION 2: If running on Vercel (live website)
    # Use your Vercel URL + /api/upload
    node scripts/camera-watcher.js ~/Desktop/photobooth-captures https://your-project-name.vercel.app/api/upload
    ```

## Step 4: (Optional) Remote Trigger Setup

If you want the "Take Photo" button on the website to actually fire your camera, you need to configure the trigger in `scripts/camera-watcher.js`.

### Option A: Using `gphoto2` (Recommended for Mac/Linux)
This is the most reliable method but requires closing Sony Imaging Edge.

1.  Install gphoto2: `brew install gphoto2` (Mac) or `sudo apt install gphoto2` (Linux).
2.  Edit `scripts/camera-watcher.js` and uncomment the **Option 1** block.
3.  Restart the watcher script.

### Option B: Using Sony Imaging Edge (Mac Only)
This uses AppleScript to simulate pressing "Enter" in the Remote app.

1.  Open `scripts/camera-watcher.js`.
2.  Uncomment the **Option 2** block.
3.  Make sure the "Remote" app is running.

### Option C: Windows
Triggering on Windows is harder. You may need to use a tool like AutoHotKey and call it from the script.

## How it Works
...existing code...

1.  You take a photo with the Sony a7IV.
2.  Imaging Edge transfers the photo to your `photobooth-captures` folder.
3.  The `camera-watcher.js` script detects the new file.
4.  It uploads the photo to your website.
5.  The script receives a QR code and automatically opens it on your laptop screen.
6.  The guest scans the QR code to get their photo!
