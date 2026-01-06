/**
 * get-kline 云函数
 * 获取指定城市的日度天气数据
 *
 * 参数: { city: 'Beijing' }
 * 返回: 日度天气数据数组
 */
const cloud = require('wx-server-sdk');
const { DB_CONFIG } = require('./config.js');

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
    // 先获取总数
    const countResult = await db.collection(DB_CONFIG.WEATHER_COLLECTION)
      .where({
        city: city
      })
      .count();

    const total = countResult.total;
    console.log('城市 ' + city + ' 共有 ' + total + ' 条记录');

    // 分批获取所有数据
    const allData = [];
    const batchTimes = Math.ceil(total / DB_CONFIG.MAX_LIMIT);

    for (let i = 0; i < batchTimes; i++) {
      const result = await db.collection(DB_CONFIG.WEATHER_COLLECTION)
        .where({
          city: city
        })
        .skip(i * DB_CONFIG.MAX_LIMIT)
        .limit(DB_CONFIG.MAX_LIMIT)
        .orderBy('date', 'asc')
        .get();

      allData.push(...result.data);
      console.log('已获取第 ' + (i + 1) + ' 批，共 ' + result.data.length + ' 条');
    }

    console.log('总共获取 ' + allData.length + ' 条记录');

    if (allData.length === 0) {
      return {
        success: false,
        error: '未找到该城市的数据'
      };
    }

    return {
      success: true,
      data: allData,
      total: total
    };

  } catch (err) {
    console.error('查询数据失败:', err);
    return {
      success: false,
      error: err.message
    };
  }
};
