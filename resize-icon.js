const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Path to the original image
const imagePath = path.join(__dirname, 'blitz_logo_color.png');
const outputDir = path.join(__dirname, 'src', 'assets');
const outputPath = path.join(outputDir, 'blitz_logo_color.png');

// Make sure the output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get image info
sharp(imagePath)
  .metadata()
  .then(metadata => {
    const { width, height } = metadata;
    
    // Calculate the new dimensions to maintain aspect ratio
    let newWidth, newHeight;
    
    if (width > height) {
      newWidth = 512;
      newHeight = Math.round((height * 512) / width);
    } else {
      newHeight = 512;
      newWidth = Math.round((width * 512) / height);
    }
    
    // Create a 512x512 transparent canvas
    const canvas = sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });
    
    // Resize the original image
    return sharp(imagePath)
      .resize(newWidth, newHeight)
      .toBuffer()
      .then(resizedBuffer => {
        // Calculate position to center the image in the canvas
        const left = Math.floor((512 - newWidth) / 2);
        const top = Math.floor((512 - newHeight) / 2);
        
        // Composite the resized image onto the canvas
        return canvas
          .composite([
            {
              input: resizedBuffer,
              top: top,
              left: left
            }
          ])
          .png()
          .toFile(outputPath);
      });
  })
  .then(() => {
    console.log(`✅ Image resized and saved to ${outputPath}`);
  })
  .catch(err => {
    console.error('Error resizing image:', err);
  }); 