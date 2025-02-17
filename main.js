const { app, BrowserWindow } = require('electron');
const path = require('path');
const backendServer = require('./backend/server'); // server.js의 Express 설정 가져오기

let mainWindow;

const isDev = process.env.NODE_ENV === 'development'; // 개발 환경 여부 확인
const FRONTEND_DEV_URL = 'http://localhost:5173'; // SvelteKit 개발 서버 주소

app.on('ready', () => {
    // 백엔드 서버 실행
    const BACKEND_PORT = 4000;
    backendServer.listen(BACKEND_PORT, () => {
        console.log(`Backend server running on http://localhost:${BACKEND_PORT}`);
    });

    // Electron 윈도우 생성
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        webPreferences: {
            nodeIntegration: true,
            webSecurity: false
        }
    });

    // 개발 환경과 배포 환경에 따라 URL 로드 분기
    if (isDev) {
        console.log('Loading frontend from development server...');
        mainWindow.loadURL(FRONTEND_DEV_URL); // 개발 서버에서 프론트엔드 로드
    } else {
        console.log('Loading frontend from static files...');
        const frontendPath = path.join(__dirname, 'frontend', 'build', 'index.html');
        mainWindow.loadURL(`file://${frontendPath}`); // 정적 파일 로드
    }

    // 개발 도구 열기 (개발 환경에서만 활성화)
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
