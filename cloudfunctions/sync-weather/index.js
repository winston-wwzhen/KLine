/**
 * sync-weather 云函数
 * 从 Open-Meteo API 获取天气数据并写入云数据库
 * 支持分批同步，避免超时
 *
 * 参数:
 * - startIndex: 开始索引（默认0）
 * - count: 同步城市数量（默认3）
 */
const cloud = require('wx-server-sdk');
const request = require('request-promise');
const { DB_CONFIG } = require('./config.js');
const { CITIES } = require('./cities.js');

// 初始化 cloud
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// Open-Meteo API 配置
const OPEN_METEO_BASE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DATE_START = '2025-01-01';
const DATE_END = '2026-01-06';

async function fetchWeatherData(city) {
  const url = OPEN_METEO_BASE_URL + '?latitude=' + city.lat + '&longitude=' + city.lon + '&start_date=' + DATE_START + '&end_date=' + DATE_END + '&daily=temperature_2m_max,temperature_2m_min&timezone=auto';

  try {
    const response = await request({
      uri: url,
      json: true,
      timeout: 30000
    });

    return response;
  } catch (err) {
    console.error('获取 ' + city.name + ' 数据失败:', err);
    throw err;
  }
}

function transformWeatherData(city, weatherData) {
  const daily = weatherData.daily;
  const records = [];

  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i];
    const dateObj = new Date(date);

    records.push({
      city: city.en,
      cityName: city.name,
      date: date,
      tempMax: Math.round(daily.temperature_2m_max[i]),
      tempMin: Math.round(daily.temperature_2m_min[i]),
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1
    });
  }

  return records;
}

async function insertRecords(records) {
  let count = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      await db.collection(DB_CONFIG.WEATHER_COLLECTION).add({
        data: record
      });
      count++;
    } catch (err) {
      console.error('插入记录失败:', record.date, err);
      throw err;
    }

    if (count % 50 === 0) {
      console.log('已插入 ' + count + '/' + records.length + ' 条记录');
    }
  }

  console.log('共插入 ' + count + ' 条记录');
  return count;
}

exports.main = async (event, context) => {
  const startIndex = event.startIndex || 0;
  const count = event.count || 3;

  const endIndex = Math.min(startIndex + count, CITIES.length);
  const cities = CITIES.slice(startIndex, endIndex);

  let successCount = 0;
  let failCount = 0;
  const errors = [];

  console.log('=== 天气数据同步 ===');
  console.log('同步范围: 第 ' + (startIndex + 1) + '-' + endIndex + ' 个城市');
  console.log('本批城市: ' + cities.map(function(c) { return c.name; }).join(', '));
  console.log('总计城市: ' + CITIES.length);

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    try {
      console.log('\n正在处理 ' + city.name + ' (' + city.en + ')...');

      const weatherData = await fetchWeatherData(city);
      const records = transformWeatherData(city, weatherData);
      console.log('获取到 ' + records.length + ' 条数据');

      await insertRecords(records);

      console.log(city.name + ' 数据同步成功');
      successCount++;

    } catch (err) {
      console.error(city.name + ' 数据同步失败:', err);
      failCount++;
      errors.push({
        city: city.name,
        error: err.message
      });
    }
  }

  const progress = Math.round((endIndex / CITIES.length) * 100);

  console.log('\n=== 本批同步完成 ===');
  console.log('成功: ' + successCount);
  console.log('失败: ' + failCount);
  console.log('总进度: ' + progress + '% (' + endIndex + '/' + CITIES.length + ')');

  return {
    success: true,
    batch: {
      startIndex: startIndex,
      endIndex: endIndex,
      total: CITIES.length,
      progress: progress + '%'
    },
    summary: {
      total: cities.length,
      successCount: successCount,
      failCount: failCount
    },
    nextStartIndex: endIndex < CITIES.length ? endIndex : null,
    errors: errors
  };
};
