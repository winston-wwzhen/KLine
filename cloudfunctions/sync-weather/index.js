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

// 初始化 cloud
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 31个省会城市数据
const PROVINCE_CAPITALS = [
  { name: '北京', en: 'Beijing', lat: 39.9042, lon: 116.4074 },
  { name: '上海', en: 'Shanghai', lat: 31.2304, lon: 121.4737 },
  { name: '天津', en: 'Tianjin', lat: 39.3434, lon: 117.3616 },
  { name: '重庆', en: 'Chongqing', lat: 29.5630, lon: 106.5516 },
  { name: '哈尔滨', en: 'Harbin', lat: 45.8038, lon: 126.5350 },
  { name: '长春', en: 'Changchun', lat: 43.8868, lon: 125.3245 },
  { name: '沈阳', en: 'Shenyang', lat: 41.8057, lon: 123.4315 },
  { name: '呼和浩特', en: 'Hohhot', lat: 40.8414, lon: 111.7519 },
  { name: '石家庄', en: 'Shijiazhuang', lat: 38.0428, lon: 114.5149 },
  { name: '太原', en: 'Taiyuan', lat: 37.8706, lon: 112.5489 },
  { name: '济南', en: 'Jinan', lat: 36.6512, lon: 117.1201 },
  { name: '郑州', en: 'Zhengzhou', lat: 34.7466, lon: 113.6253 },
  { name: '西安', en: 'Xian', lat: 34.3416, lon: 108.9398 },
  { name: '兰州', en: 'Lanzhou', lat: 36.0611, lon: 103.8343 },
  { name: '银川', en: 'Yinchuan', lat: 38.4872, lon: 106.2309 },
  { name: '西宁', en: 'Xining', lat: 36.6171, lon: 101.7782 },
  { name: '乌鲁木齐', en: 'Urumqi', lat: 43.8256, lon: 87.6168 },
  { name: '合肥', en: 'Hefei', lat: 31.8206, lon: 117.2272 },
  { name: '南京', en: 'Nanjing', lat: 32.0603, lon: 118.7969 },
  { name: '杭州', en: 'Hangzhou', lat: 30.2741, lon: 120.1551 },
  { name: '长沙', en: 'Changsha', lat: 28.2282, lon: 112.9388 },
  { name: '南昌', en: 'Nanchang', lat: 28.6820, lon: 115.8579 },
  { name: '武汉', en: 'Wuhan', lat: 30.5928, lon: 114.3055 },
  { name: '成都', en: 'Chengdu', lat: 30.5728, lon: 104.0668 },
  { name: '贵阳', en: 'Guiyang', lat: 26.6470, lon: 106.6302 },
  { name: '昆明', en: 'Kunming', lat: 25.0389, lon: 102.7183 },
  { name: '南宁', en: 'Nanning', lat: 22.8170, lon: 108.3665 },
  { name: '广州', en: 'Guangzhou', lat: 23.1291, lon: 113.2644 },
  { name: '福州', en: 'Fuzhou', lat: 26.0745, lon: 119.2965 },
  { name: '海口', en: 'Haikou', lat: 20.0444, lon: 110.1999 },
  { name: '台北', en: 'Taipei', lat: 25.0330, lon: 121.5654 },
  { name: '拉萨', en: 'Lhasa', lat: 29.6525, lon: 91.1721 },
];

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
  
  const endIndex = Math.min(startIndex + count, PROVINCE_CAPITALS.length);
  const cities = PROVINCE_CAPITALS.slice(startIndex, endIndex);
  
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  console.log('=== 天气数据同步 ===');
  console.log('同步范围: 第 ' + (startIndex + 1) + '-' + endIndex + ' 个城市');
  console.log('本批城市: ' + cities.map(function(c) { return c.name; }).join(', '));
  console.log('总计城市: ' + PROVINCE_CAPITALS.length);

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

  const progress = Math.round((endIndex / PROVINCE_CAPITALS.length) * 100);

  console.log('\n=== 本批同步完成 ===');
  console.log('成功: ' + successCount);
  console.log('失败: ' + failCount);
  console.log('总进度: ' + progress + '% (' + endIndex + '/' + PROVINCE_CAPITALS.length + ')');

  return {
    success: true,
    batch: {
      startIndex: startIndex,
      endIndex: endIndex,
      total: PROVINCE_CAPITALS.length,
      progress: progress + '%'
    },
    summary: {
      total: cities.length,
      successCount: successCount,
      failCount: failCount
    },
    nextStartIndex: endIndex < PROVINCE_CAPITALS.length ? endIndex : null,
    errors: errors
  };
};
