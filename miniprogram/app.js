// 云环境配置文件（本地不提交）
try {
  const cloudConfig = require('./cloud.config.js');
  App({
    onLaunch() {
      // 初始化云开发
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      } else {
        wx.cloud.init({
          env: cloudConfig.env,
          traceUser: true,
        });
      }
    },

    globalData: {
      userInfo: null
    }
  });
} catch (e) {
  console.error('请先创建 cloud.config.js 文件并配置云环境ID');
  console.error('参考 cloud.config.example.js');
  App({
    onLaunch() {
      console.error('云环境未配置');
    },
    globalData: {
      userInfo: null
    }
  });
}
