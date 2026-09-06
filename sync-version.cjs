const fs = require('fs');
const path = require('path');

// 1. Read version from package.json
const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

// 2. Parse version for versionCode (e.g. 1.0.2 -> 10002)
const parts = version.split('.');
const major = parseInt(parts[0]) || 0;
const minor = parseInt(parts[1]) || 0;
const patch = parseInt(parts[2]) || 0;
const versionCode = major * 10000 + minor * 100 + patch;

// 3. Update android/app/build.gradle
const gradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode \d+/g, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName "[^"]+"/g, `versionName "${version}"`);
  fs.writeFileSync(gradlePath, gradle);
  console.log(`\n\x1b[32m[FLUX] Android version updated to ${version} (Code: ${versionCode})\x1b[0m`);
} else {
  console.warn('\x1b[33m[FLUX] android/app/build.gradle not found\x1b[0m');
}
