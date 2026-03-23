# 灵芝水铺 AI 系统 - 阿里云部署指南

## 第一步：本地准备
1. 在您本地的项目文件夹中，将除 `node_modules`, `.next`, `.git` 之外的所有文件打包成一个 `lingzhi-app.zip` 压缩包。
   * **或者**，如果您使用 Git，直接在服务器 `git clone` 您的仓库。

## 第二步：上传到服务器
使用 SCP 或 FTP 工具（如 FileZilla, Xftp）将压缩包上传到阿里云服务器。
* 推荐目录：`/var/www/lingzhi-ai`

## 第三步：执行部署
登录 SSH，进入目录并执行以下命令：

```bash
# 1. 解压 (如果还没解压)
unzip lingzhi-app.zip -d /var/www/lingzhi-ai
cd /var/www/lingzhi-ai

# 2. 赋予脚本执行权限
chmod +x server-setup.sh

# 3. 运行一键安装
./server-setup.sh
```

## 第四步：开放端口
1. 登录阿里云后台 -> ECS 实例 -> 安全组 -> 配置规则。
2. 添加一条 **入方向** 规则：
   * 端口范围：`3001/3001`
   * 授权对象：`0.0.0.0/0`

## 第五步：访问
在浏览器打开：`http://您的公网IP:3001`

---

## 常见问题

### 如何停止/重启服务？
```bash
pm2 stop lingzhi-ai
pm2 restart lingzhi-ai
```

### 如何查看日志？
```bash
pm2 logs lingzhi-ai
```

### 端口冲突怎么办？
如果 3001 被占用，请修改 `ecosystem.config.js` 文件中的 `PORT` 字段，然后重启：
```bash
pm2 restart lingzhi-ai
```
