# 陈薯条 / Shutiao Chen：AI 本机安装指南

此文适用于用户已请求安装本桌宠、且你有该用户电脑终端操作能力的情况。目标是将 **YujieChen8888/Shutiao** 安装并启动在用户本机。公开仓库无需 GitHub 登录或 token；应用也不需要 AI API key。角色参数和全部装扮已随源码内置，不需要用户提供猫咪照片。

## 1. 识别环境并取得源码

- 判断系统、架构，以及是否已有 Shutiao 安装和源码。优先复用现有工具；首次安装缺失依赖时使用官方来源。
- macOS：原生 Apple Silicon 或 Intel 构建；Windows：本指南针对 Windows 10 / 11 x64，使用原生 Windows 工具链，不在 WSL 中构建 Windows 桌面程序。
- 选一个用户自己的项目目录。已有同名目录时先检查内容，不覆盖不相关文件。
- 记录构建的 Git 提交。升级时保留未提交修改，只在适合的干净分支使用 `git pull --ff-only`。

首次下载：

```sh
git clone https://github.com/YujieChen8888/Shutiao.git
cd Shutiao
git rev-parse HEAD
```

没有 Git 时可从本仓库 GitHub 页面下载源码 ZIP 并解压，后续命令在解压后的项目根目录执行。以本仓库 README 为准，`docs/README.upstream.zh-CN.md` 是原版的历史说明。

## 2. 通用依赖

检查 `node --version`、`npm --version`、`rustc --version`、`cargo --version`。

- Node.js 22 或更新的兼容版本，附带 npm：[Node.js 官方下载](https://nodejs.org/en/download)。
- Rust 当前 stable 工具链：[rustup 官方安装](https://rustup.rs/)。不要依赖较旧的系统 Rust；仓库使用 Cargo.lock v4。
- 平台原生依赖见下文，依据 [Tauri 官方环境要求](https://v2.tauri.app/start/prerequisites/)。

安装后若当前终端仍找不到工具，刷新当前会话的 PATH 或使用工具的绝对路径。不要覆盖现有环境配置。系统安装器要求管理员操作、协议确认或隐私授权时，按当前用户授权和工具规则处理。

## 3. macOS

### 检查工具链

```sh
uname -m
xcode-select -p
xcrun --find clang
```

缺少 Xcode Command Line Tools 时运行 `xcode-select --install`，等待系统安装完成。只安装桌面版不要求完整 Xcode。Rust 安装后，可在当前 shell 使用 `. "$HOME/.cargo/env"` 加载其路径。确认 `rustc -vV` 的 host 与当前原生架构一致。

### 构建

在项目根目录：

```sh
npm ci
npm run tauri -- build --bundles app
```

构建命令会自动执行前端构建，无需先运行开发服务器。目标产物：

```text
src-tauri/target/release/bundle/macos/Shutiao.app
```

校验本地生成应用的签名；若打包后的临时签名无效，对**本次自己构建的产物**重新做 ad hoc 签名并再次验证：

```sh
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/Shutiao.app
# 仅在上述校验失败时执行以下修复：
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/Shutiao.app
codesign --verify --deep --strict src-tauri/target/release/bundle/macos/Shutiao.app
```

首次安装推荐复制到用户的 `~/Applications/Shutiao.app`，也可以使用有写入权限的 `/Applications/Shutiao.app`。若已有应用，先正常退出并备份旧 bundle，复用原安装位置；保留设置目录。不要同时保留多个正在运行的副本。

以下命令仅用于**目的地尚不存在**的首次安装：

```sh
mkdir -p "$HOME/Applications"
test ! -e "$HOME/Applications/Shutiao.app" && ditto src-tauri/target/release/bundle/macos/Shutiao.app "$HOME/Applications/Shutiao.app"
open "$HOME/Applications/Shutiao.app"
```

键鼠联动需要用户在「系统设置 → 隐私与安全性」中给 **Shutiao** 开启「辅助功能」和「输入监控」。未授予时，角色和日历仍可显示，但不能把未验证的全局键鼠联动报告为正常。应用标识是 `com.yujiechen.shutiao`。源代码安装不需要关闭 Gatekeeper 或其他系统安全功能。

## 4. Windows 10 / 11 x64

### 检查工具链

在 PowerShell 检查：

```powershell
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
node --version
npm.cmd --version
rustc -vV
cargo --version
```

- 安装微软 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，选择 **Desktop development with C++ / 使用 C++ 的桌面开发**，包含 MSVC 和 Windows SDK。
- 检查 [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)，缺少时安装官方 Evergreen Runtime。
- Rust host 应为 `x86_64-pc-windows-msvc`。C++ 工具链不在当前 PATH 时，使用 Visual Studio 的 x64 Native Tools Command Prompt 或 Developer PowerShell。
- 如果 PowerShell 阻止 `npm.ps1`，使用 `npm.cmd`，无需修改全局脚本执行策略。

### 直接编译应用，无需生成安装包

```powershell
npm.cmd ci
npm.cmd run tauri -- build --no-bundle
if ($LASTEXITCODE -ne 0) { throw 'Shutiao build failed' }
```

产物为 `src-tauri\target\release\Shutiao.exe`。当前项目的前端资源内置于程序中；运行仍需要 WebView2 Runtime。

首次安装可以放到 `%LOCALAPPDATA%\Programs\Shutiao\Shutiao.exe`，并为用户创建快捷方式。以下示例在已有安装时停止，以免覆盖正在运行的程序：

```powershell
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\Shutiao'
$appPath = Join-Path $installDir 'Shutiao.exe'
if (Test-Path $appPath) { throw '已有安装，请退出并备份旧版本后再更新' }
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item '.\src-tauri\target\release\Shutiao.exe' $appPath
Start-Process $appPath
```

若用户希望有开始菜单、桌面快捷方式和卸载入口，可在本机生成 NSIS 安装器后运行：

```powershell
npm.cmd run tauri -- build --bundles nsis
```

安装器位于 `src-tauri\target\release\bundle\nsis\*-setup.exe`。检查实际生成的文件后运行；无需 GitHub Actions。当前分支尚未在 Windows 实机完成验证，如有失败，应报告具体阶段和错误，不要宣称已经安装成功。

## 5. 安装后的验证

1. 应用进程存活，桌面实际出现 **陈薯条 / Shutiao Chen**，而非只启动网页预览。
2. 右键 → 衣橱，检查装扮可以切换；根据用户偏好选择，默认晴空项圈。
3. 右键 → 提醒，确认月历、日期/时间和事件输入可用，默认存在每 2 小时一次的喝水任务。点击「试一下」验证气泡，不改动正式时间。
4. 确认设置可保存。只清理自己创建的测试事件，保留用户已有任务。
5. 如果用户授权全局键鼠权限，再验证实际打字与鼠标动作。首次编译和安装依赖可能需要较长时间；应用退出或电脑关机期间不能弹出提醒。

本机 MCP 默认地址为 `http://127.0.0.1:27430/mcp`。可用 HTTP POST 读取实际设置辅助验证：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_settings","arguments":{}}}
```

请求头设置 `Content-Type: application/json`，检查响应没有错误且 `catBreed` 为 `shutiao`。若端口不通，先确认进程、用户是否关闭 MCP 或更改端口，不要启动第二个副本。

## 6. 更新与保留数据

- macOS：`~/Library/Application Support/shutiao-pet/`
- Windows：`%APPDATA%\shutiao-pet\`

保留 `settings.json`、`cats.json`、`reminders.json`。升级只替换程序，保留用户装扮、窗口位置和日程。移除程序时也不要顺便删除用户数据，除非用户明确要求。

成功后告诉用户：安装位置、实际测试的平台/架构、如何启动、右键菜单入口，以及仍需本人完成的系统授权。无需索取或分享仓库维护者的 GitHub token。
