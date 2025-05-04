# Electron Minecraft Launcher

This is an Electron port of the BlitzLauncher Minecraft launcher originally built with JavaFX.

## Features

- Modern UI with Electron
- Microsoft account authentication (cracked mode with F7 key)
- Automatic download and installation of game files
- Cross-platform support (Windows, macOS, Linux)

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm start` to start the application in development mode

### Building

To build the application for your current platform:

```
npm run build
```

To build for specific platforms:

```
npm run build:mac
npm run build:win
npm run build:linux
```

## Usage

1. Launch the application
2. Login with your Microsoft account (or press F7 for cracked mode)
3. Click the "Start" button to launch Minecraft

## Implementation Notes

- The Minecraft launching logic is the same as the original Java version
- Authentication has been simplified but can be extended with the Microsoft Authentication Library (MSAL)
- Electron's IPC (Inter-Process Communication) is used for secure communication between main and renderer processes 