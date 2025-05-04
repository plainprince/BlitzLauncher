const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Account management
    loginMicrosoft: () => ipcRenderer.invoke('login-microsoft'),
    loginCracked: () => ipcRenderer.invoke('login-cracked'),
    
    // Minecraft launch
    launchMinecraft: (data) => ipcRenderer.invoke('launch-minecraft', data),
    
    // External links
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
    
    // IPC event listeners
    on: (channel, callback) => {
      // Whitelist of valid channels
      const validChannels = ['account-loaded', 'device-code', 'minecraft-closed', 'minecraft-status'];
      if (validChannels.includes(channel)) {
        // Remove the event listener when it's no longer needed
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        
        // Return a function to remove the event listener
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    }
  }
); 