const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');
const { MinecraftStarter } = require('./minecraftStarter');
const { Auth } = require('msmc');

// Initialize data store
const store = new Store();

// Define app data directory based on OS
const getAppDataDirectory = () => {
  switch (process.platform) {
    case 'win32':
      return process.env.APPDATA;
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support');
    case 'linux':
      return path.join(os.homedir(), '.local/share');
    default:
      throw new Error('Unsupported OS for app data directory');
  }
};

const INSTALL_DIR = path.join(getAppDataDirectory(), 'BlitzClient', 'client-installer');

// Global reference to the main window
let mainWindow;

function createWindow() {
  // Set the icon path based on platform with absolute paths
  let iconPath;
  if (process.platform === 'win32') {
    iconPath = path.resolve(__dirname, 'assets/icon.ico');
  } else {
    iconPath = path.resolve(__dirname, 'assets/blitz_logo_color.png');
  }

  console.log('Using icon path:', iconPath);
  console.log('Icon exists:', fs.existsSync(iconPath));

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: iconPath
  });

  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Check if accounts.json exists
  const accountsPath = path.join(path.dirname(INSTALL_DIR), 'accounts.json');
  if (fs.existsSync(accountsPath)) {
    try {
      const accountData = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('account-loaded', accountData);
      });
    } catch (error) {
      console.error('Error loading account data:', error);
    }
  }
}

// Create the main window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers
ipcMain.handle('login-microsoft', async () => {
  try {
    // Create a new Auth manager with select_account prompt
    const authManager = new Auth("select_account");
    
    // Launch using 'electron' as the GUI framework
    // This will open a popup for Microsoft login
    const xbox = await authManager.launch("electron");
    
    try {
      // Get the Minecraft profile
      const minecraftProfile = await xbox.getMinecraft();
      
      // Extract necessary data from the Minecraft profile
      const accountData = {
        uuid: minecraftProfile.profile.id,
        name: minecraftProfile.profile.name,
        refreshToken: xbox.save() // Save refresh token instead of access token
      };
      
      // Save account data - ensure directory exists first
      const accountsDirectory = path.dirname(INSTALL_DIR);
      const accountsPath = path.join(accountsDirectory, 'accounts.json');
      
      // Create the directory if it doesn't exist
      if (!fs.existsSync(accountsDirectory)) {
        fs.mkdirSync(accountsDirectory, { recursive: true });
      }
      
      fs.writeFileSync(accountsPath, JSON.stringify(accountData, null, 2));
      
      return accountData;
    } catch (mcError) {
      console.error('Minecraft profile error:', mcError);
      
      // Check if the error is related to not owning Minecraft
      if (mcError.response && mcError.response.status === 404) {
        throw new Error("This Microsoft account doesn't own Minecraft. Please purchase Minecraft from minecraft.net to use this launcher.");
      }
      
      // Re-throw other errors
      throw mcError;
    }
  } catch (error) {
    console.error('Microsoft login error:', error);
    // Pass through the custom error message if we already created one
    throw new Error(error.message || 'Failed to login with Microsoft account');
  }
});

ipcMain.handle('login-cracked', async () => {
  const uuid = uuidv4();
  const name = "dev";
  
  const accountData = { 
    uuid, 
    name,
    refreshToken: null // Cracked accounts don't have refresh tokens
  };
  
  // Save account data - ensure directory exists first
  const accountsDirectory = path.dirname(INSTALL_DIR);
  const accountsPath = path.join(accountsDirectory, 'accounts.json');
  
  // Create the directory if it doesn't exist
  if (!fs.existsSync(accountsDirectory)) {
    fs.mkdirSync(accountsDirectory, { recursive: true });
  }
  
  fs.writeFileSync(accountsPath, JSON.stringify(accountData, null, 2));
  
  return accountData;
});

ipcMain.handle('launch-minecraft', async (event, { uuid, name }) => {
  try {
    const minecraftStarter = new MinecraftStarter();
    
    // Get fresh access token if this is a Microsoft account
    let accessToken = null;
    const accountsPath = path.join(path.dirname(INSTALL_DIR), 'accounts.json');
    
    if (fs.existsSync(accountsPath)) {
      try {
        const accountData = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
        console.log('Loaded account data:', { uuid: accountData.uuid, name: accountData.name, hasRefreshToken: !!accountData.refreshToken });
        
        // Check if this is a Microsoft account with a refresh token
        if (accountData.refreshToken) {
          try {
            console.log('Attempting to refresh access token...');
            // Use refresh token to get fresh access token
            const authManager = new Auth("select_account");
            const xbox = await authManager.refresh(accountData.refreshToken);
            const minecraftProfile = await xbox.getMinecraft();
            accessToken = minecraftProfile.access_token;
            
            console.log('Successfully refreshed access token');
            console.log('Token length:', accessToken ? accessToken.length : 0);
            console.log('Profile info:', {
              id: minecraftProfile.profile.id,
              name: minecraftProfile.profile.name
            });
            
            // Validate that the token is not empty or malformed
            if (!accessToken || accessToken.length < 10) {
              throw new Error('Received invalid or empty access token');
            }
            
            // Update the refresh token in case it changed
            const updatedAccountData = {
              ...accountData,
              refreshToken: xbox.save()
            };
            fs.writeFileSync(accountsPath, JSON.stringify(updatedAccountData, null, 2));
            console.log('Updated refresh token in account data');
            
          } catch (error) {
            console.error('Failed to refresh access token:', error);
            console.warn('Launching in offline mode due to token refresh failure');
            accessToken = null;
            
            // If refresh fails, the account might need re-authentication
            // You could optionally clear the refresh token here or prompt for re-login
            if (error.message && error.message.includes('invalid_grant')) {
              console.warn('Refresh token is invalid - user may need to re-authenticate');
              // Send a message to the renderer to prompt for re-authentication
              mainWindow.webContents.send('auth-expired');
            }
          }
        } else {
          console.log('No refresh token found - this is a cracked account or offline mode');
        }
      } catch (error) {
        console.warn('Could not load account data:', error);
      }
    } else {
      console.log('No account data file found');
    }
    
    // Check if BlitzClient directory exists
    const blitzClientPath = path.dirname(INSTALL_DIR);
    const minecraftPath = path.join(blitzClientPath, 'minecraft');
    
    if (!fs.existsSync(blitzClientPath)) {
      fs.mkdirSync(blitzClientPath, { recursive: true });
    }
    
    const isFirstLaunch = !fs.existsSync(INSTALL_DIR);
    
    if (isFirstLaunch) {
      // Only show installation message on first launch
      mainWindow.webContents.send('minecraft-status', { message: 'Installing Minecraft files... This may take a while.' });
      
      // Download and extract files
      await minecraftStarter.download();
    }
    
    // Launch Minecraft
    const minecraftProcess = minecraftStarter.run(uuid, name, accessToken);
    
    // If minecraft directory doesn't exist, download mods after startup
    if (!fs.existsSync(minecraftPath)) {
      if (isFirstLaunch) {
        mainWindow.webContents.send('minecraft-status', { message: 'Downloading mods...' });
      }
      
      try {
        await minecraftStarter.downloadMods();
        await minecraftStarter.downloadResourcepack();
        await minecraftStarter.configureResourcepack();
        // Clear the status message after mods have been downloaded
        mainWindow.webContents.send('minecraft-status', { message: null });
      } catch (error) {
        console.error('Error downloading mods:', error);
        // Show error but let Minecraft continue running
        mainWindow.webContents.send('minecraft-status', { message: 'Error downloading mods' });
      }
    }
    
    // Listen for Minecraft process to exit
    if (minecraftProcess && minecraftProcess.on) {
      minecraftProcess.on('exit', (code) => {
        console.log(`Minecraft process exited with code ${code}`);
        // Re-enable the start button after Minecraft closes
        mainWindow.webContents.send('minecraft-closed');
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error launching Minecraft:', error);
    // Re-enable the button on error
    mainWindow.webContents.send('minecraft-closed');
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external-link', async (event, url) => {
  await shell.openExternal(url);
  return true;
});

ipcMain.handle('re-authenticate', async () => {
  try {
    // Clear existing account data
    const accountsPath = path.join(path.dirname(INSTALL_DIR), 'accounts.json');
    if (fs.existsSync(accountsPath)) {
      fs.unlinkSync(accountsPath);
    }
    
    // Create a new Auth manager with select_account prompt
    const authManager = new Auth("select_account");
    
    // Launch using 'electron' as the GUI framework
    const xbox = await authManager.launch("electron");
    
    // Get the Minecraft profile
    const minecraftProfile = await xbox.getMinecraft();
    
    // Extract necessary data from the Minecraft profile
    const accountData = {
      uuid: minecraftProfile.profile.id,
      name: minecraftProfile.profile.name,
      refreshToken: xbox.save()
    };
    
    // Save account data
    const accountsDirectory = path.dirname(INSTALL_DIR);
    if (!fs.existsSync(accountsDirectory)) {
      fs.mkdirSync(accountsDirectory, { recursive: true });
    }
    
    fs.writeFileSync(accountsPath, JSON.stringify(accountData, null, 2));
    
    return accountData;
  } catch (error) {
    console.error('Re-authentication error:', error);
    throw error;
  }
}); 