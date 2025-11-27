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
    
    # Example (Mac/Linux):
    node scripts/camera-watcher.js ~/Desktop/photobooth-captures https://your-app-name.vercel.app/api/upload
    
    # Example (Windows):
    node scripts/camera-watcher.js "C:\Users\You\Desktop\photobooth-captures" https://your-app-name.vercel.app/api/upload
    ```

## How it Works

1.  You take a photo with the Sony a7IV.
2.  Imaging Edge transfers the photo to your `photobooth-captures` folder.
3.  The `camera-watcher.js` script detects the new file.
4.  It uploads the photo to your website.
5.  The script receives a QR code and automatically opens it on your laptop screen.
6.  The guest scans the QR code to get their photo!
