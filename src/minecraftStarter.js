const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');
const extract = require('extract-zip');

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;  // Datei existiert
  } catch {
    return false; // Datei existiert nicht
  }
}

class MinecraftStarter {
  constructor() {
    this.INSTALL_DIR = this.getAppDataDirectory() + path.sep + 'BlitzClient' + path.sep + 'client-installer';
  }

  getAppDataDirectory() {
    const platform = process.platform;
    const userHome = os.homedir();

    switch (platform) {
      case 'win32':
        return process.env.APPDATA;
      case 'darwin':
        return path.join(userHome, 'Library/Application Support');
      case 'linux':
        return path.join(userHome, '.local/share');
      default:
        throw new Error('Unsupported OS for app data directory');
    }
  }

  async download() {
    const platform = process.platform;
    const arch = process.arch;

    let platformName;
    switch (platform) {
      case 'win32':
        platformName = 'windows';
        break;
      case 'darwin':
        platformName = 'macos';
        break;
      case 'linux':
        platformName = 'linux';
        break;
      default:
        throw new Error(`Unsupported OS: ${platform}`);
    }

    let architecture;
    switch (arch) {
      case 'x64':
        architecture = 'x64';
        break;
      case 'arm64':
        architecture = 'arm64';
        break;
      default:
        throw new Error(`Unsupported architecture: ${arch}`);
    }

    const fileName = `${platformName}-${architecture}.zip`;
    const urlStr = `https://nightly.link/plainprince/BlitzLauncher/workflows/pythonbuild/main/${fileName}`;

    const zipPath = path.join(this.INSTALL_DIR, fileName);
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });

    try {
      // Download the file
      const response = await axios({
        method: 'GET',
        url: urlStr,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Node.js downloader'
        }
      });

      // Check if response is a zip (content type check)
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.includes('zip')) {
        throw new Error(`Error downloading: Invalid content type: ${contentType}`);
      }

      // Write the file
      fs.writeFileSync(zipPath, response.data);

      // Check if the file is too small (likely not a valid zip)
      const fileStats = fs.statSync(zipPath);
      if (fileStats.size < 100) {
        throw new Error('Downloaded file is too small - probably not a valid ZIP.');
      }

      // Extract the zip
      await this.unzip(zipPath, this.INSTALL_DIR);

      // Make the executable file executable on macOS and Linux
      if (platform === 'darwin' || platform === 'linux') {
        const executablePath = path.join(this.INSTALL_DIR, 'os');
        fs.chmodSync(executablePath, 0o755);
      }

      return true;
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async unzip(zipPath, targetDir) {
    try {
      await extract(zipPath, { dir: targetDir });
      return true;
    } catch (error) {
      console.error('Error extracting zip:', error);
      throw error;
    }
  }

  async downloadMods() {
    return new Promise(async (resolve, reject) => {
      const sodiumUrl = "https://cdn.modrinth.com/data/AANobbMI/versions/DA250htH/sodium-fabric-0.6.13%2Bmc1.21.5.jar";
      const irisUrl = "https://cdn.modrinth.com/data/YL57xq9U/versions/U6evbjd0/iris-fabric-1.8.11%2Bmc1.21.5.jar";
      const modsDir = path.join(path.dirname(this.INSTALL_DIR), 'minecraft/mods');
      
      try {
        fs.mkdirSync(modsDir, { recursive: true });

        // Download Sodium
        const sodiumResponse = await axios({
          method: 'GET',
          url: sodiumUrl,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Node.js downloader'
          }
        });

        const sodiumJarPath = path.join(modsDir, 'sodium-fabric-0.6.13+mc1.21.5.jar');
        fs.writeFileSync(sodiumJarPath, sodiumResponse.data);
        
        // Download Iris Shaders
        const irisResponse = await axios({
          method: 'GET',
          url: irisUrl,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Node.js downloader'
          }
        });

        const irisJarPath = path.join(modsDir, 'iris-fabric-1.8.11+mc1.21.5.jar');
        fs.writeFileSync(irisJarPath, irisResponse.data);
        
        resolve(true);
      } catch (error) {
        console.error('Error downloading mods:', error);
        reject(error);
      }
    })
  }

  async downloadResourcepack() {
    return new Promise(async (resolve, reject) => {
      const resourcepackUrl = "https://blitzclient.netlify.app/resourcepack.zip";
      const parentDir = path.dirname(this.INSTALL_DIR);
      console.log('Parent directory:', parentDir);

      const resourcepacksDir = path.join(parentDir, 'minecraft/resourcepacks');
      const resourcepackPath = path.join(resourcepacksDir, 'resourcepack.zip');
      
      console.log('Download info:', {
        url: resourcepackUrl,
        parentDir: parentDir,
        resourcepacksDir: resourcepacksDir,
        resourcepackPath: resourcepackPath
      });
      
      try {
        // Check if resourcepack already exists
        if (fs.existsSync(resourcepackPath)) {
          console.log('Resourcepack already exists, skipping download');
          resolve(true);
          return;
        }

        fs.mkdirSync(resourcepacksDir, { recursive: true });
        console.log('Created resourcepacks directory:', resourcepacksDir);

        // Download Resourcepack
        console.log('Starting download from:', resourcepackUrl);
        const resourcepackResponse = await axios({
          method: 'GET',
          url: resourcepackUrl,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Node.js downloader'
          }
        });

        console.log('Download completed, response size:', resourcepackResponse.data.length);
        fs.writeFileSync(resourcepackPath, resourcepackResponse.data);
        console.log('Resourcepack saved to:', resourcepackPath);
        
        // Verify the file was written
        if (fs.existsSync(resourcepackPath)) {
          const stats = fs.statSync(resourcepackPath);
          console.log('Resourcepack file size:', stats.size, 'bytes');
        }
        
        console.log('Resourcepack downloaded successfully');
        resolve(true);
      } catch (error) {
        console.error('Error downloading resourcepack:', error);
        reject(error);
      }
    });
  }

  async configureResourcepack() {
    try {
      const parentDir = path.dirname(this.INSTALL_DIR);
      const optionsPath = path.join(parentDir, 'minecraft/options.txt');
      const resourcepacksDir = path.join(parentDir, 'minecraft/resourcepacks');
      const resourcepackPath = path.join(resourcepacksDir, 'resourcepack.zip');
      
      console.log('Configure resourcepack info:', {
        parentDir: parentDir,
        optionsPath: optionsPath,
        resourcepackPath: resourcepackPath,
        resourcepackExists: fs.existsSync(resourcepackPath),
        optionsExists: fs.existsSync(optionsPath)
      });
      
      // Check if resourcepack exists
      if (!(await fileExists(resourcepackPath))) {
        console.log('Resourcepack not found, skipping configuration');
        return false;
      }

      let optionsContent = '';
      let resourcePacksLine = 'resourcePacks:["fabric","file/resourcepack.zip"]';
      
      // Read existing options.txt if it exists
      if (await fileExists(optionsPath)) {
        optionsContent = fs.readFileSync(optionsPath, 'utf8');
        console.log('Existing options.txt content length:', optionsContent.length);
        
        // Check if resourcePacks line already exists
        const lines = optionsContent.split('\n');
        let resourcePackLineIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('resourcePacks:')) {
            resourcePackLineIndex = i;
            console.log('Found existing resourcePacks line at index', i, ':', lines[i]);
            break;
          }
        }
        
        if (resourcePackLineIndex !== -1) {
          // Update existing resourcePacks line
          const currentLine = lines[resourcePackLineIndex];
          // Parse the current resourcePacks array and add our pack if not already present
          if (!currentLine.includes('file/resourcepack.zip')) {
            // Simple approach: replace the closing bracket with our pack
            const updatedLine = currentLine.replace(/]$/, ',"file/resourcepack.zip"]');
            lines[resourcePackLineIndex] = updatedLine;
            console.log('Updated resourcePacks line to:', updatedLine);
          } else {
            console.log('Resourcepack already configured in options.txt');
          }
          optionsContent = lines.join('\n');
        } else {
          // Add resourcePacks line
          console.log('Adding new resourcePacks line');
          optionsContent += '\n' + resourcePacksLine + '\n';
        }
      } else {
        // Create new options.txt with resourcepack
        console.log('Creating new options.txt with resourcepack');
        optionsContent = resourcePacksLine + '\n';
      }
      
      // Write the updated options.txt
      console.log('Writing options.txt to:', optionsPath);
      fs.writeFileSync(optionsPath, optionsContent);
      console.log('Resourcepack configured in options.txt successfully');
      return true;
    } catch (error) {
      console.error('Error configuring resourcepack:', error);
      return false;
    }
  }

  async run(uuid, name) {
    try {
      const installDir = path.resolve(this.INSTALL_DIR);
      const parentDir = path.dirname(installDir);
      const minecraftDir = path.join(parentDir, 'minecraft');

      const executablePath = path.join(installDir, 'os');

      // Base arguments
      const args = [
        executablePath,
        '--uuid',
        uuid ? uuid.toString() : '0000',
        '--name',
        name ? name : 'Whyareyoureadingthis'
      ];

      // If minecraft directory exists, append --launch-only
      if (fs.existsSync(minecraftDir)) {
        args.push('--launch-only');
      }

      // Spawn the process
      const process = spawn(args[0], args.slice(1), {
        cwd: parentDir,
        stdio: 'inherit',
        detached: true
      });

      process.on('error', (error) => {
        console.error(`Error running executable: ${error.message}`);
      });

      process.unref();
      return process;
    } catch (error) {
      console.error('Error running executable:', error);
      throw error;
    }
  }
}

module.exports = { MinecraftStarter }; 