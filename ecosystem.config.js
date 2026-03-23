module.exports = {
  apps: [
    {
      name: "lingzhi-ai",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
        PORT: 3001 // 默认运行在 3001 端口，如有冲突请修改
      }
    }
  ]
};
