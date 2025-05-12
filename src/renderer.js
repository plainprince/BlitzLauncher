// DOM elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const loginButton = document.getElementById('login-button');
const loginInstruction = document.getElementById('login-instruction');
const loginLink = document.getElementById('login-link');
const startMinecraftButton = document.getElementById('start-minecraft-button');
const statusMessage = document.getElementById('status-message');

// Global state
let userData = null;

// Register event listeners
document.addEventListener('keydown', (event) => {
  // F7 key for cracked mode
  if (event.key === 'F7') {
    activateCrackedMode();
  }
});

loginButton.addEventListener('click', handleLogin);
startMinecraftButton.addEventListener('click', handleMinecraftLaunch);
loginLink.addEventListener('click', (event) => {
  event.preventDefault();
  const url = loginLink.getAttribute('href');
  if (url && url !== '#') {
    window.api.openExternalLink(url);
  }
});

// Listen for account data loaded from main process
window.api.on('account-loaded', (data) => {
  if (data && data.uuid && data.name) {
    userData = {
      uuid: data.uuid,
      name: data.name
    };
    showMainSection();
  }
});

// Listen for device code from main process
window.api.on('device-code', (data) => {
  loginInstruction.textContent = `Go to ${data.verificationUrl} and enter the code: ${data.userCode}`;
  loginLink.textContent = data.verificationUrl;
  loginLink.setAttribute('href', data.verificationUrl);
  loginButton.disabled = true;
});

// Listen for Minecraft closed event
window.api.on('minecraft-closed', () => {
  startMinecraftButton.disabled = false;
  statusMessage.textContent = '';
});

// Listen for Minecraft status updates
window.api.on('minecraft-status', (data) => {
  if (data) {
    statusMessage.textContent = data.message || '';
  }
});

// Functions
function showAlert(type, title, message) {
  // Simple alert using native dialog
  alert(`${title}\n\n${message}`);
}

function activateCrackedMode() {
  loginButton.textContent = 'Login (Cracked Mode)';
  loginButton.style.backgroundColor = '#ff9800';
  
  // Change the login function to use cracked mode
  loginButton.removeEventListener('click', handleLogin);
  loginButton.addEventListener('click', handleCrackedLogin);
}

async function handleLogin() {
  loginInstruction.textContent = 'Starting Microsoft login...';
  
  try {
    // Clear any previous link
    loginLink.textContent = '';
    loginLink.setAttribute('href', '#');
    
    // Start the Microsoft authentication process
    const data = await window.api.loginMicrosoft();
    
    userData = {
      uuid: data.uuid,
      name: data.name
    };
    
    loginInstruction.textContent = '';
    loginButton.disabled = false;
    showAlert('info', 'Login Successful', `Welcome, ${data.name}!`);
    
    showMainSection();
  } catch (error) {
    console.error('Login error:', error);
    loginInstruction.textContent = '';
    loginButton.disabled = false;
    showAlert('error', 'Login Error', error.message || 'Failed to login. Please try again.');
  }
}

async function handleCrackedLogin() {
  loginInstruction.textContent = 'Logging in...';
  
  try {
    const data = await window.api.loginCracked();
    
    userData = {
      uuid: data.uuid,
      name: data.name
    };
    
    loginInstruction.textContent = '';
    showAlert('info', 'Login Successful', `Welcome, ${data.name}!`);
    
    showMainSection();
  } catch (error) {
    console.error('Cracked login error:', error);
    loginInstruction.textContent = '';
    showAlert('error', 'Login Error', error.message || 'Failed to login. Please try again.');
  }
}

function showMainSection() {
  loginSection.style.display = 'none';
  mainSection.style.display = 'flex';
}

async function handleMinecraftLaunch() {
  if (!userData) {
    showAlert('error', 'Error', 'You need to login first.');
    return;
  }
  
  try {
    startMinecraftButton.disabled = true;
    
    // Only show a status message for the first launch
    // The main process will send specific status updates if needed
    
    const result = await window.api.launchMinecraft({
      uuid: userData.uuid,
      name: userData.name
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error launching Minecraft');
    }
    
    // The button will be re-enabled when Minecraft closes via the 'minecraft-closed' event
  } catch (error) {
    console.error('Launch error:', error);
    startMinecraftButton.disabled = false;
    statusMessage.textContent = '';
    showAlert('error', 'Launch Error', error.message || 'Failed to launch Minecraft. Please try again.');
  }
} 