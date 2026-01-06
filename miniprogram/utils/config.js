/**
 * 配置文件
 */
module.exports = {
  // 云函数名称
  CLOUD_FUNCTIONS: {
    GET_KLINE: 'get-kline',
    SYNC_WEATHER: 'sync-weather'
  },

  // 数据库集合名称
  COLLECTIONS: {
    WEATHER_DATA: 'weather_data'
  },

  // K线图配置
  KLINE_CONFIG: {
    // 红涨绿跌
    COLORS: {
      UP: '#ef5350',    // 红色（上涨）
      DOWN: '#26a69a',  // 绿色（下跌）
      NEUTRAL: '#909399'
    },
    // K线图类型
    CHART_TYPE: 'candlestick',
    // 默认选择城市
    DEFAULT_CITY: 'Beijing',
    // 默认城市中文名
    DEFAULT_CITY_NAME: '北京'
  },

  // 数据时间范围
  DATE_RANGE: {
    START: '2025-01-01',
    END: '2026-01-06'
  },

  // Open-Meteo API 配置（用于云函数）
  OPEN_METEO: {
    BASE_URL: 'https://archive-api.open-meteo.com/v1/archive',
    // 每次请求的城市数量（避免请求过大）
    BATCH_SIZE: 5
  }
};
