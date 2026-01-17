import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import treeKill from 'tree-kill';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Backend service processes
let apiProcess: ChildProcess | null = null;
let aiServicesProcess: ChildProcess | null = null;
let webProcess: ChildProcess | null = null;

// Main window
let mainWindow: BrowserWindow | null = null;

// Ports configuration
const PORTS = {
  web: 3000,
  api: 3001,
  aiServices: 8000,
};

/**
 * Get resource path (works in both dev and production)
 */
function getResourcePath(...segments: string[]): string {
  if (isDev) {
    // In development, use project root
    return path.join(__dirname, '../../..', ...segments);
  }
  // In production, use app resources
  return path.join(process.resourcesPath, ...segments);
}

/**
 * Start API backend service
 */
function startApiService(): Promise<void> {
  return new Promise((resolve, reject) => {
    // In production, API is in extraResources/api
    const apiPath = isDev 
      ? getResourcePath('packages', 'api')
      : getResourcePath('api');
    const apiDistPath = isDev 
      ? path.join(apiPath, 'dist', 'main.js')
      : path.join(apiPath, 'main.js');

    // Check if built API exists
    if (!fs.existsSync(apiDistPath) && !isDev) {
      console.error('API build not found at:', apiDistPath);
      reject(new Error('API service build not found'));
      return;
    }

    const nodePath = process.execPath;
    const apiEnv = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: PORTS.api.toString(),
      CORS_ORIGIN: `http://localhost:${PORTS.web}`,
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
      DB_DATABASE: 'pulsecal',
      DB_SSL: 'false',
      DB_SYNCHRONIZE: 'false',
      DB_LOGGING: 'false',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
    };

    if (isDev) {
      // Development: use pnpm
      apiProcess = spawn('pnpm', ['--filter', 'api', 'start:dev'], {
        cwd: getResourcePath(),
        env: apiEnv,
        shell: true,
      });
    } else {
      // Production: run built API
      apiProcess = spawn(nodePath, [apiDistPath], {
        cwd: apiPath,
        env: apiEnv,
      });
    }

    apiProcess.stdout?.on('data', (data) => {
      console.log(`[API] ${data}`);
      if (data.toString().includes('running on')) {
        resolve();
      }
    });

    apiProcess.stderr?.on('data', (data) => {
      console.error(`[API Error] ${data}`);
    });

    apiProcess.on('error', (error) => {
      console.error('[API] Failed to start:', error);
      reject(error);
    });

    apiProcess.on('exit', (code) => {
      console.log(`[API] Process exited with code ${code}`);
      apiProcess = null;
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (apiProcess && apiProcess.pid) {
        resolve(); // Assume it started if process exists
      } else {
        reject(new Error('API service startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Start AI Services backend
 */
function startAiServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    const aiServicesPath = isDev 
      ? getResourcePath('packages', 'ai-services')
      : getResourcePath('ai-services');
    const runPyPath = path.join(aiServicesPath, 'run.py');

    if (!fs.existsSync(runPyPath)) {
      console.warn('AI Services not found at:', runPyPath);
      console.log('AI Services are optional - continuing without them');
      resolve(); // AI services are optional
      return;
    }

    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    
    const aiEnv = {
      ...process.env,
      HOST: '0.0.0.0',
      PORT: PORTS.aiServices.toString(),
      DEBUG: 'false',
      CORS_ORIGINS: JSON.stringify([`http://localhost:${PORTS.web}`, `http://localhost:${PORTS.api}`]),
    };

    aiServicesProcess = spawn(pythonCommand, [runPyPath], {
      cwd: aiServicesPath,
      env: aiEnv,
      shell: true,
    });

    aiServicesProcess.stdout?.on('data', (data) => {
      console.log(`[AI Services] ${data}`);
      if (data.toString().includes('Uvicorn running') || data.toString().includes('Application startup')) {
        resolve();
      }
    });

    aiServicesProcess.stderr?.on('data', (data) => {
      console.error(`[AI Services Error] ${data}`);
    });

    aiServicesProcess.on('error', (error) => {
      console.warn('[AI Services] Failed to start:', error);
      console.log('[AI Services] Continuing without AI services (they are optional)');
      // Don't reject - AI services are optional
      resolve();
    });

    aiServicesProcess.on('exit', (code) => {
      console.log(`[AI Services] Process exited with code ${code}`);
      aiServicesProcess = null;
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (aiServicesProcess && aiServicesProcess.pid) {
        resolve();
      } else {
        resolve(); // AI services are optional, don't fail
      }
    }, 30000);
  });
}

/**
 * Start Next.js web server (for production)
 */
function startWebServer(): Promise<void> {
  return new Promise((resolve) => {
    if (isDev) {
      // In dev, Next.js runs separately
      resolve();
      return;
    }

    // In production, use standard Next.js build
    // The web package node_modules should be included in the bundle
    const webPath = getResourcePath('web');
    const nodePath = process.execPath;
    
    // Try to find next in bundled node_modules
    const nextBinPath = path.join(webPath, 'node_modules', '.bin', 'next');
    const nextBinCmd = fs.existsSync(nextBinPath) ? nextBinPath : 'next';
    
    webProcess = spawn(nodePath, [nextBinCmd, 'start'], {
      cwd: webPath,
      env: {
        ...process.env,
        PORT: PORTS.web.toString(),
        NODE_ENV: 'production',
        HOSTNAME: 'localhost',
      },
      shell: true, // Use shell to find next in PATH if not in node_modules
    });

    webProcess.stdout?.on('data', (data) => {
      console.log(`[Web] ${data}`);
    });

    webProcess.stderr?.on('data', (data) => {
      console.error(`[Web Error] ${data}`);
    });

    webProcess.on('exit', (code) => {
      console.log(`[Web] Process exited with code ${code}`);
      webProcess = null;
    });

    setTimeout(() => resolve(), 10000);
  });
}

/**
 * Stop all backend services
 */
function stopBackendServices(): Promise<void> {
  return new Promise((resolve) => {
    const processes = [apiProcess, aiServicesProcess, webProcess].filter(Boolean) as ChildProcess[];

    if (processes.length === 0) {
      resolve();
      return;
    }

    let stopped = 0;
    const total = processes.length;

    processes.forEach((proc) => {
      if (proc.pid) {
        treeKill(proc.pid, 'SIGTERM', (err) => {
          if (err) {
            console.error('Error stopping process:', err);
          }
          stopped++;
          if (stopped === total) {
            resolve();
          }
        });
      } else {
        stopped++;
        if (stopped === total) {
          resolve();
        }
      }
    });
  });
}

/**
 * Create main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Load the application with retry logic (Next.js takes time to start)
  const url = `http://localhost:${PORTS.web}`;

  // Retry loading the URL if it fails (Next.js might still be starting)
  const loadUrlWithRetry = async (retries = 15): Promise<void> => {
    try {
      await mainWindow?.loadURL(url);
      console.log('✅ Successfully loaded application');
    } catch (err) {
      if (retries > 0) {
        console.log(`⏳ Next.js still starting, retrying in 2 seconds... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return loadUrlWithRetry(retries - 1);
      } else {
        console.error('❌ Failed to load URL after all retries:', err);
        // Show error in window
        mainWindow?.loadURL(`data:text/html,<html><body style="font-family: Arial; padding: 40px; text-align: center;"><h1>Application Starting...</h1><p>Please wait for services to start.</p><p>If this persists, check the console for errors.</p></body></html>`);
      }
    }
  };

  // Show window immediately with loading message
  mainWindow.once('ready-to-show', () => {
    // Show loading message first
    const loadingHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f5f5f5;">
          <h1 style="color: #333;">PulseCal SecureBand</h1>
          <p style="color: #666; font-size: 16px;">Starting application...</p>
          <p style="color: #999; font-size: 14px;">Please wait for services to initialize.</p>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">This may take 30-60 seconds on first run.</p>
        </body>
      </html>
    `;
    mainWindow?.loadURL(`data:text/html,${encodeURIComponent(loadingHtml)}`);
    mainWindow?.show();
    
    // Focus the window
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
    
    // Start loading actual app after delay (give services time to start)
    setTimeout(() => {
      loadUrlWithRetry();
    }, 10000); // Wait 10 seconds before trying to load
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== `http://localhost:${PORTS.web}`) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

/**
 * Wait for backend services to be ready
 */
async function waitForServices(): Promise<void> {
  const maxAttempts = 30;
  const delay = 1000;

  // Use Node.js built-in http module instead of fetch
  const http = require('http');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${PORTS.api}/health`, (res: any) => {
          if (res.statusCode === 200) {
            console.log('Backend services are ready');
            resolve();
          } else {
            reject(new Error(`Status: ${res.statusCode}`));
          }
        });
        req.on('error', () => reject(new Error('Connection failed')));
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return;
    } catch (error) {
      // Service not ready yet, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  console.warn('Backend services may not be fully ready, but continuing...');
}

// App event handlers
app.whenReady().then(async () => {
  console.log('Starting PulseCal SecureBand Desktop Application...');

  // Start backend services
  try {
    console.log('Starting API service...');
    await startApiService();
    console.log('API service started');

    console.log('Starting AI Services...');
    await startAiServices();
    console.log('AI Services started (or skipped)');

    // Start web server in both dev and production
    console.log('Starting web server...');
    if (isDev) {
      // In development, start Next.js dev server via pnpm
      const webPath = getResourcePath('packages', 'web');
      webProcess = spawn('pnpm', ['dev'], {
        cwd: webPath,
        env: {
          ...process.env,
          PORT: PORTS.web.toString(),
          NODE_ENV: 'development',
        },
        shell: true,
      });

      webProcess.stdout?.on('data', (data) => {
        console.log(`[Web] ${data}`);
      });

      webProcess.stderr?.on('data', (data) => {
        console.error(`[Web Error] ${data}`);
      });

      webProcess.on('exit', (code) => {
        console.log(`[Web] Process exited with code ${code}`);
        webProcess = null;
      });
    } else {
      await startWebServer();
    }

    // Wait for services to be ready (give web server time to start)
    console.log('Waiting for services to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds for Next.js to start
    await waitForServices();
    
    // Additional wait for Next.js compilation
    console.log('Giving Next.js additional time to compile...');
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait another 10 seconds

    // Create and show window
    createWindow();
  } catch (error) {
    console.error('Failed to start services:', error);
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await stopBackendServices();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  await stopBackendServices();
});

// IPC handlers
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:get-platform', () => {
  return process.platform;
});

ipcMain.handle('app:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('app:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('app:close', () => {
  mainWindow?.close();
});

ipcMain.handle('app:set-fullscreen', (_, fullscreen: boolean) => {
  mainWindow?.setFullScreen(fullscreen);
});

ipcMain.handle('app:set-kiosk', (_, kiosk: boolean) => {
  mainWindow?.setKiosk(kiosk);
});

// Security: Prevent new window creation (already handled in createWindow)
// Modern Electron uses setWindowOpenHandler instead
