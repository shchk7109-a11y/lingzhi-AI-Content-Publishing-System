# Windows 打包与调试指南

> 本应用最终运行在 **Windows**（依赖 Bit 指纹浏览器）。
> **必须在 Windows 机器上打包**——不要在 macOS/Linux 上交叉打包，因为 `better-sqlite3`
> 是原生 C++ 模块，需要 Windows 版二进制，交叉编译不可靠。

---

## 一、把源码弄到 Windows 机器

用 git（推荐）：

```powershell
git clone <你的仓库地址>
cd lingzhi-AI-Content-Publishing-System
```

或直接拷贝文件夹，但 **不要拷贝** 这两个目录（它们是 Mac 版产物，到 Windows 必须重新生成）：
- `node_modules/`
- `out/`、`dist/`

---

## 二、准备环境（Windows）

1. 安装 **Node.js 20.x 或 22.x**（https://nodejs.org 下载 LTS）。
2. 安装依赖（国内建议先设镜像加速）：

```powershell
npm config set registry https://registry.npmmirror.com
npm install
```

`npm install` 会自动下载 **Windows 版** 的 `better-sqlite3` 预编译二进制，无需手动编译。
若下载失败（网络问题），可重试或设置：

```powershell
npm config set better_sqlite3_binary_host_mirror https://npmmirror.com/mirrors/better-sqlite3
npm install better-sqlite3 --build-from-source
```

（`--build-from-source` 需要 Visual Studio Build Tools，含 C++ 桌面开发工作负载。）

---

## 三、准备应用图标（打包前必须）

打包配置 `electron-builder.yml` 指定了 `resources/icon.ico`，但仓库里还没有这个文件。
两个选择：

- **放一个图标**：准备一个 **256×256** 的 `icon.ico`，放到 `resources/icon.ico`。
  （可用在线工具把 PNG 转 ICO。）
- **暂时不用自定义图标**：编辑 `electron-builder.yml`，把 `win:` 下的 `icon: resources/icon.ico`
  这一行删掉或注释掉，打包时会用 Electron 默认图标。

---

## 四、先跑起来验证（可选但推荐）

打包前先用开发模式确认能正常运行：

```powershell
npm run dev
```

会弹出应用窗口。若要连 Bit 浏览器，需先启动 Bit 指纹浏览器并开启其本地 API（默认端口 54345）。

---

## 五、打包成 Windows 安装包

```powershell
npm run package:win
```

这条命令会依次：
1. `electron-vite build`（编译主进程 / 预加载 / 渲染进程）
2. `electron-builder --win`（打成 NSIS 安装包）

**产物位置**：`dist/` 目录下，会生成类似
`灵芝水铺发布系统 Setup 3.0.0.exe` 的安装程序。双击即可安装。

---

## 六、常见问题

| 现象 | 原因 / 解决 |
|------|------|
| 安装后启动即崩，报找不到 `better_sqlite3.node` | 依赖没打进包。确认 `electron-builder.yml` 的 `files` **没有** `!node_modules/**/*`（本仓库已修复）。 |
| 打包报错找不到 `icon.ico` | 见上方「准备应用图标」。 |
| `better-sqlite3` 安装/编译失败 | 网络问题或缺编译工具。用镜像重试，或装 Visual Studio Build Tools（C++ 工作负载）。 |
| 应用能开但连不上 Bit | Bit 浏览器没启动，或 API 端口不是 54345。在「设置」里改端口并「测试连接」。 |

---

## 七、连 Bit 浏览器做真机测试（Windows）

1. 安装并启动 **Bit 指纹浏览器**，开启本地 API（默认 `127.0.0.1:54345`）。
2. 在 Bit 里为每个账号创建 profile，记下各自的 **Profile ID**。
3. 本系统「账号管理」里为每个账号填入对应的 **Bit Profile ID** 和 **地区**。
4. 「设置」→「住宅代理网关」填入住宅代理供应商信息并启用，按供应商文档调整用户名模板。
5. 「账号管理」点某账号的 **测试代理**，确认出口 IP 稳定且为目标城市。
