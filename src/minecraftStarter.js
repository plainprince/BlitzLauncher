const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');
const extract = require('extract-zip');

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

  run(uuid, name) {
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