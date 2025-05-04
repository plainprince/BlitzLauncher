const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to the original image
const imagePath = path.join(__dirname, 'blitz_logo_color.png');
const outputDir = path.join(__dirname, 'src', 'assets');
const tempDir = path.join(__dirname, 'temp_icons');

// Make sure the output and temp directories exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
} else {
  // Clear temp directory
  const files = fs.readdirSync(tempDir);
  for (const file of files) {
    fs.unlinkSync(path.join(tempDir, file));
  }
}

// Icon sizes for Windows (16, 32, 48, 64, 128, 256)
const sizes = [16, 32, 48, 64, 128, 256];

// Function to resize image and maintain aspect ratio with transparent background
async function resizeIcon(size) {
  try {
    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;
    
    // Calculate the new dimensions to maintain aspect ratio
    let newWidth, newHeight;
    
    if (width > height) {
      newWidth = size;
      newHeight = Math.round((height * size) / width);
    } else {
      newHeight = size;
      newWidth = Math.round((width * size) / height);
    }
    
    // Create a square canvas with transparent background
    const canvas = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });
    
    // Resize the original image
    const resizedBuffer = await sharp(imagePath)
      .resize(newWidth, newHeight)
      .toBuffer();
    
    // Calculate position to center the image in the canvas
    const left = Math.floor((size - newWidth) / 2);
    const top = Math.floor((size - newHeight) / 2);
    
    // Composite the resized image onto the canvas
    await canvas
      .composite([
        {
          input: resizedBuffer,
          top: top,
          left: left
        }
      ])
      .png()
      .toFile(path.join(tempDir, `icon-${size}.png`));
    
    console.log(`✅ Generated ${size}x${size} icon`);
  } catch (err) {
    console.error(`Error generating ${size}x${size} icon:`, err);
  }
}

// Install png-to-ico if not already installed
async function installPngToIco() {
  try {
    try {
      // Try to access the module to check if it's installed
      require.resolve('png-to-ico');
      console.log('png-to-ico is already installed');
    } catch (e) {
      // If not installed, install it
      console.log('Installing png-to-ico...');
      execSync('npm install png-to-ico --no-save');
      console.log('png-to-ico installed successfully');
    }
    return true;
  } catch (error) {
    console.error('Failed to install png-to-ico:', error);
    return false;
  }
}

// Create the ICO file
async function createIcoFile() {
  try {
    const pngToIco = require('png-to-ico');
    
    const pngFiles = sizes.map(size => path.join(tempDir, `icon-${size}.png`));
    
    // Convert PNGs to ICO
    const icoBuffer = await pngToIco(pngFiles);
    
    // Save ICO file
    fs.writeFileSync(path.join(outputDir, 'icon.ico'), icoBuffer);
    console.log(`✅ ICO file created at ${path.join(outputDir, 'icon.ico')}`);
  } catch (err) {
    console.error('Error creating ICO file:', err);
  }
}

// Main function
async function main() {
  try {
    // Generate all icon sizes
    await Promise.all(sizes.map(size => resizeIcon(size)));
    
    // Install png-to-ico
    const installed = await installPngToIco();
    
    if (installed) {
      // Create ICO file
      await createIcoFile();
    }
    
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
    
    console.log('✅ Icon generation complete');
  } catch (err) {
    console.error('Error in main function:', err);
  }
}

// Run the script
main(); 