/**
 * get-kline 云函数
 * 获取指定城市的日度天气数据
 *
 * 参数: { city: 'Beijing' }
 * 返回: 日度天气数据数组
 */
const cloud = require('wx-server-sdk');

// 初始化 cloud
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { city } = event;

  if (!city) {
    return {
      success: false,
      error: '请指定城市'
    };
  }

  try {
    // 从云数据库查询该城市的所有日度数据
    const result = await db.collection('weather_data')
      .where({
        city: city
      })
      .orderBy('date', 'asc')
      .get();

    if (result.data.length === 0) {
      return {
        success: false,
        error: '未找到该城市的数据'
      };
    }

    return {
      success: true,
      data: result.data
    };

  } catch (err) {
    console.error('查询数据失败:', err);
    return {
      success: false,
      error: err.message
    };
  }
};
