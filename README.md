> 基于 [qianyiai/KuroCat](https://github.com/qianyiai/kurocat) 二次创作，感谢原作者与社区贡献者。原项目及本项目使用 MIT 许可证，原始版权声明保留于 [LICENSE](LICENSE)。

# 🍟 陈薯条 · Shutiao Chen

一只属于你的暹罗猫桌面伙伴。浅蓝眼睛、深咖啡重点色、暖米色身体，陪你打字、换装，也记得提醒你喝水。

## 新增功能

- **陈薯条专属角色**：参考真实照片，通过 KuroCat 内置 MCP 创建角色参数，再内置到 2D / 3D 渲染器。细调脸型、耳朵、眼睑、身体比例与重点色；英文名 **Shutiao Chen**。
- **陈薯条的衣橱**：照片同款「晴空项圈」「薄荷奶糖」「燕麦针织」「小小伯爵」，加上「海盐水手」「柠檬雨衣」「新年围巾」，共 7 套装扮与原生毛色模式。3D 衣服随身体动作变形，2D 同步支持。
- **每两小时喝水提醒**：首次运行自动创建并启用；在桌面弹出陈薯条的提醒与表情。
- **右键日历事件**：月历选日期，填写事件与具体时间；支持单次、每天、每周指定星期，也保留按间隔提醒。可修改、暂停、恢复、删除、立即测试，单次事件触发后标记完成，最多 30 项。
- **持久化后台计时**：关闭菜单、闲置降帧不影响计时，退出后保留任务与下次时间，睡眠或下次启动只补一次过期提醒，避免连续轰炸。
- **独立应用配置**：Shutiao 与原版 KuroCat 使用不同的应用标识、数据目录及 MCP / OBS 端口；更新入口指向本仓库。

## 使用

启动 **Shutiao**，右键猫咪：

1. **外观**：选择「陈薯条」，切换 2D / 3D、调整互动行为。
2. **衣橱**：点选装扮，立即穿上并自动保存。
3. **提醒**：在月历选一天，填写事件、时间和重复方式。喝水提醒也可以修改或暂停；「试一下」不改变正式计时。
4. **系统**：尺寸、键盘、声音、开机启动等设置。

提醒由应用后台运行，只在应用运行时显示；不是关机后的系统闹钟。同一时刻的多个提醒会依次出现，密码输入时延后显示。修改内容保留原计时，修改计划或重新启用会重新计算。日历事件按电脑本地时区运行；每日/每周重复按日历日计算，不按固定 24 小时累加。夏令时不存在的时刻跳过，重复的时刻只提醒一次。

装扮与外观是基于原版程序模型的风格化还原，并非照片级 3D 扫描。照片仅作为制作参考，仓库不包含原始私人照片。新增衣橱和提醒界面目前使用简体中文。

## macOS / Windows

- **macOS**：保留 Apple Silicon 与 Intel 支持，CI 构建通用版 `.dmg`。
- **Windows 10 / 11 x64**：保留原生键鼠监听、透明置顶和托盘，CI 构建 NSIS `.exe` 安装包。
- 两个平台共用衣橱、日历提醒与 MCP 功能；本地首先验证 macOS，Windows 构建由 GitHub Actions 验证。
- 每次推送触发 [双平台构建](https://github.com/YujieChen8888/Shutiao/actions)，成功后可在对应任务的 Artifacts 下载。安装包为开源未公证/未商业签名版本。

## 本地开发与构建

需要 Node.js 22+、Rust stable 和对应平台的 Tauri 构建环境。macOS 需 Xcode Command Line Tools。

```bash
git clone https://github.com/YujieChen8888/Shutiao.git
cd Shutiao
npm ci
npm run tauri:dev
```

```bash
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run tauri:build
```

macOS 仅生成应用：`npm run tauri -- build --bundles app`。产物位于 `src-tauri/target/release/bundle/macos/Shutiao.app`。

首次使用键鼠联动，请在 macOS「系统设置 → 隐私与安全性」中给 **Shutiao** 开启「辅助功能」和「输入监控」。

## MCP 定制

运行 Shutiao 后，MCP 地址是 `http://127.0.0.1:27430/mcp`，OBS 地址是 `http://127.0.0.1:27431/obs`。

```json
{
  "mcpServers": {
    "shutiao": { "url": "http://127.0.0.1:27430/mcp" }
  }
}
```

角色参数在 [`src/assets/shutiao.json`](src/assets/shutiao.json)，前端和 Rust 共用这一份数据。可运行 `python3 scripts/setup-shutiao.py` 通过 MCP 重新导入角色。连接原版 KuroCat 时传入 `--url http://127.0.0.1:27420/mcp`。

用 `patch_cat` 微调角色，用 `update_settings` 的 `outfitId` 选装扮：`none` / `blue-collar` / `mint-vest` / `oat-knit` / `vampire` / `sailor` / `raincoat` / `festive`。

## 数据与更新

- macOS：`~/Library/Application Support/shutiao-pet/`
- Windows：`%APPDATA%\shutiao-pet\`
- Linux：`~/.config/shutiao-pet/`
- `settings.json`：外观、装扮和窗口设置；`cats.json`：MCP 自定义角色；`reminders.json`：提醒任务与下次时间。

本分支采用手动下载安装更新，避免原版自动更新覆盖二创内容。版本与安装包见 [Releases](https://github.com/YujieChen8888/Shutiao/releases)。保留上游历史，原版详细说明见 [上游项目](https://github.com/qianyiai/kurocat)。
