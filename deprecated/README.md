# Deprecated Files

This folder contains files from previous iterations of the project that are no longer used in the current Vercel + Remote Camera architecture.

- **camera-watcher.js**: Old script that watched a local folder for photos (used with Sony Imaging Edge). Replaced by `scripts/remote-camera.js` which controls the camera directly via gphoto2.
- **electron-main.js**: Main process for the Electron desktop app version. We moved to a web-based architecture hosted on Vercel.
- **README_CAMERA.md**: Instructions for the old `camera-watcher.js` workflow.
- **README_WINDOWS.md**: Windows-specific instructions for the old workflow.
