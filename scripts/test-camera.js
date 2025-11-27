const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('📸 Camera Test Script');
console.log('-------------------');

// 1. Determine filename
const filename = path.join(__dirname, `test-capture-${Date.now()}.jpg`);
console.log(`📍 Target file: ${filename}`);

// 2. Determine command
// Try to use the one in PATH first, otherwise warn user
const command = `CameraControlCmd.exe /capture /filename "${filename}"`;

console.log(`⚡ Executing: ${command}`);

exec(command, (err, stdout, stderr) => {
  if (err) {
    console.error('\n❌ Error executing command:');
    console.error(err.message);
    
    if (err.message.includes('not found') || err.message.includes('is not recognized')) {
      console.log('\n💡 TIP: It looks like "CameraControlCmd.exe" is not in your system PATH.');
      console.log('   Please install digicamControl (http://digicamcontrol.com/)');
      console.log('   And add its installation folder to your System PATH variables.');
      console.log('   Default location: C:\\Program Files (x86)\\digiCamControl');
    }
    return;
  }

  console.log('\n⏳ Waiting for photo to be saved...');

  // Wait a moment for the file to appear
  let checks = 0;
  const maxChecks = 10;
  
  const checkInterval = setInterval(() => {
    checks++;
    if (fs.existsSync(filename)) {
      clearInterval(checkInterval);
      console.log(`\n✅ SUCCESS! Photo captured and saved to:`);
      console.log(filename);
    } else if (checks >= maxChecks) {
      clearInterval(checkInterval);
      console.log('\n⚠️  Command finished but file was not found.');
      console.log('   - Check if your camera is connected via USB');
      console.log('   - Check if "PC Remote" is ON in camera settings');
      console.log('   - Open digicamControl manually to see if it detects the camera');
    } else {
      process.stdout.write('.');
    }
  }, 500);
});
