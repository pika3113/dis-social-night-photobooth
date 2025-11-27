# 🖥️ Running as a Windows Desktop App

You can convert this web app into a standalone Windows application (`.exe`). This is the **most reliable way** to use the camera trigger.

## Why use the Desktop App?
1.  **Direct Camera Control**: The app can talk directly to your camera (via USB) without needing a separate "watcher" script.
2.  **Faster**: No network lag when triggering the camera.
3.  **Offline-Capable**: The app runs locally (though you still need internet for Cloudinary uploads).

## Prerequisites (On your Windows Laptop)

1.  **Node.js**: Install from [nodejs.org](https://nodejs.org/).
2.  **digicamControl**: Install from [digicamcontrol.com](http://digicamcontrol.com/).
    *   This free software handles the USB communication with your Sony camera.
    *   *Important*: Make sure `CameraControlCmd.exe` is in your system PATH, or edit `server.js` to point to its full path (usually `C:\Program Files (x86)\digiCamControl\CameraControlCmd.exe`).

## How to Install & Run

1.  **Download the Code**:
    *   Clone this repository to your Windows laptop.
    *   Or download as a ZIP and extract it.

2.  **Install Dependencies**:
    Open PowerShell or Command Prompt in the folder and run:
    ```bash
    npm install
    ```

3.  **Run the App**:
    ```bash
    npm run electron
    ```
    *   This will open a window with your Photobooth app.
    *   The server starts automatically in the background.

## How to Build a Standalone .exe (Optional)

If you want to create a single file that you can copy to other computers:

1.  Install `electron-builder`:
    ```bash
    npm install --save-dev electron-builder
    ```

2.  Add this script to `package.json`:
    ```json
    "scripts": {
      "dist": "electron-builder"
    }
    ```

3.  Build it:
    ```bash
    npm run dist
    ```
    *   Check the `dist` folder for your `.exe` file!

## Troubleshooting

*   **"Camera not triggering"**:
    *   Make sure **digicamControl** is installed.
    *   Open `server.js` and check the `CameraControlCmd.exe` path.
    *   Ensure your camera is connected via USB and set to "PC Remote".
