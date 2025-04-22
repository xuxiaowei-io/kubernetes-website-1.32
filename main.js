// Modules to control application life and create native browser window

import { app, net, protocol, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'
import Store from 'electron-store'
import fs from 'fs/promises'

import './ipc-main.js'
import './menu.js'
import './updater.js'

const store = new Store()

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// 日志文件名，默认日志位置：
// Windows 开发：C:\Users\%USERPROFILE%\AppData\Roaming\Electron\logs
// Windows 安装：C:\Users\%USERPROFILE%\AppData\Roaming\项目名称\logs
// macOS 开发：/Users/$USER/Library/Logs/Electron
// macOS 安装：/Users/$USER/Library/Logs/项目名称
// Linux 开发：~/.config/Electron/logs
// Linux 运行 *.AppImage：~/.config/项目名称/logs
// Linux 安装 *.deb：~/.config/项目名称/logs
// Linux 安装 *.snap：~/snap/项目名称/x1/.config/项目名称/logs
log.transports.file.fileName = 'main.log'
log.scope.defaultLabel = 'main'
log.scope.labelPadding = 8

const disableHttp = log.create({ logId: 'disableHttp' })
disableHttp.transports.file.fileName = 'disableHttp.log'
disableHttp.scope.defaultLabel = 'disableHttp'

log.info('Hello from Electron 👋')

// 创建一个新的日志记录器
const loader = log.create({ logId: 'loader' })
loader.transports.file.fileName = 'loader.log'
loader.scope.defaultLabel = 'loader'
loader.scope.labelPadding = 8

const devTools = store.get('devTools')
if (typeof devTools !== 'boolean') {
  store.set('devTools', process.env.NODE_ENV === 'development')
}

const languageFeatures = {
  'en-US': 'dist/index.html', // 英语（主版本）
  bn: 'dist/bn/index.html', // 孟加拉语
  'zh-CN': 'dist/zh-cn/index.html', // 简体中文
  fr: 'dist/fr/index.html', // 法语
  de: 'dist/de/index.html', // 德语
  hi: 'dist/hi/index.html', // 印地语
  id: 'dist/id/index.html', // 印尼语
  it: 'dist/it/index.html', // 意大利语
  ja: 'dist/ja/index.html', // 日语
  ko: 'dist/ko/index.html', // 韩语
  pl: 'dist/pl/index.html', // 波兰语
  'pt-BR': 'dist/pt-br/index.html', // 巴西葡萄牙语
  ru: 'dist/ru/index.html', // 俄语
  es: 'dist/es/index.html', // 西班牙语
  uk: 'dist/uk/index.html', // 乌克兰语
  vi: 'dist/vi/index.html', // 越南语
}

// Windows 开发：C:\Users\%USERPROFILE%\AppData\Roaming\Electron\config.json
// Windows 安装：C:\Users\%USERPROFILE%\AppData\Roaming\项目名称\config.json
// macOS 开发：/Users/$USER/Library/Application Support/Electron/config.json
// macOS 安装：/Users/$USER/Library/Application Support/项目名称/config.json
// Linux 开发：~/.config/Electron/config.json
// Linux 运行 *.AppImage：~/.config/项目名/config.json
// Linux 安装 *.deb：~/.config/项目名/config.json
// Linux 安装 *.snap：~/snap/项目名/x1/.config/项目名/config.json
log.info('electron-store path', store.path)

// 定义一个方法，拒绝所有 http、https 协议
const diableHttp = function() {

  // 拦截所有 http 请求
  protocol.handle('http', (request, callback) => {
    disableHttp.log('http: ' + request.url)
    callback({
      // 直接返回 403 禁止访问
      statusCode: 403,
      data: null
    })
  })

  // 拦截所有 https 请求
  protocol.handle('https', (request, callback) => {
    disableHttp.log('https: ' + request.url)
    callback({
      // 直接返回 403 禁止访问
      statusCode: 403,
      data: null
    })
  })
}

// 协议名称，自定义
const scheme = 'k8s-website-v1-32'

// 新增协议注册函数
const registerProtocol = () => {
  protocol.handle(scheme, async (request) => {
    const url = request.url
    const parsedUrl = url
      .substring(scheme.length + 3)
      .split('?')[0]
      .replace(/^(\.\.(\/|\\|$))+/, '')
    const requestedPath = path.join(__dirname, parsedUrl)
    let normalizedPath = path.normalize(requestedPath)
    if (normalizedPath.endsWith(path.sep)) {
      normalizedPath = path.join(normalizedPath, 'index.html')
    }
    try {
      await fs.access(normalizedPath, fs.constants.R_OK)
      loader.info(
        `url: ${url}, parsedUrl: ${parsedUrl}, requestedPath: ${requestedPath}, normalizedPath: ${normalizedPath}`,
      )
      return net.fetch(`file://${normalizedPath}`)
    } catch {
      const fallbackPath = path.join(__dirname, 'dist', 'index.html')
      loader.warn(
        `url: ${url}, parsedUrl: ${parsedUrl}, requestedPath: ${requestedPath}, fallbackPath: ${fallbackPath}`,
      )
      return net.fetch(`file://${fallbackPath}`)
    }
  })
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: devTools,
    },
  })

  let url = languageFeatures[app.getLocale()]
  url = url === undefined ? languageFeatures['en-US'] : url

  // load the index.html of the app.
  mainWindow.loadURL(`${scheme}://${url}`).catch((err) => {
    log.error('mainWindow.loadURL', err)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  // 使用参数控制是否开启 http 协议
  const enableHttp = store.get('enableHttp')
  if (enableHttp !== true) {
    diableHttp()
    store.set('enableHttp', false)
  }

  registerProtocol()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
