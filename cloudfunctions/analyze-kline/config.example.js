/**
 * 云函数配置文件模板
 *
 * 使用方法：
 * 1. 复制此文件并重命名为 config.js
 * 2. 填入你的真实配置信息
 * 3. 部署云函数时会自动打包 config.js
 */

// 微信云开发环境ID
const CLOUD_ENV_ID = 'your_cloud_env_id_here';

// 智谱AI API配置
const GLM_CONFIG = {
  API_URL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  API_KEY: 'your_glm_api_key_here',  // 从 https://open.bigmodel.cn/ 获取
  MODEL: 'glm-4-flash',  // 使用glm-4-flash模型（性价比高，速度快）
  // 其他可用模型: glm-4, glm-4-plus, glm-4-air
  TIMEOUT: 30000, // 30秒超时
  MAX_RETRIES: 3,  // 最大重试次数
};

// 数据库配置
const DB_CONFIG = {
  // 天气数据集合
  WEATHER_COLLECTION: 'weather_data',
  // K线分析集合
  ANALYSIS_COLLECTION: 'kline_analysis',
  // 每次查询最大限制
  MAX_LIMIT: 1000
};

module.exports = {
  CLOUD_ENV_ID,
  GLM_CONFIG,
  DB_CONFIG
};
