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
    DEFAULT_CITY_NAME: '北京',
    // 默认显示模式
    DEFAULT_MODE: 'original'
  },

  // 显示模式配置
  DISPLAY_MODES: [
    { value: 'original', label: '原始温度', desc: '显示每周的实际温度范围。开盘=周一最低温，收盘=周日最低温，实体越长表示周内温差越大。' },
    { value: 'zscore', label: 'Z-score标准化', desc: '温度标准化处理，突出异常周。0表示全年平均，正数表示高于平均，负数表示低于平均。不同城市的波动差异更明显。' },
    { value: 'range', label: '昼夜温差', desc: '显示每日最高温与最低温的差值。数值越大表示昼夜温差越大，内陆城市通常温差更明显。' },
    { value: 'cumulative', label: '累积距平', desc: '累积每周温度与全年平均的偏差。上升表示整体偏暖，下降表示整体偏冷。可直观看出全年温度趋势。' },
    { value: 'acceleration', label: '温度加速度', desc: '显示温度变化的变化率(二阶导数)。反映温度变化的快慢，正值表示加速升温，负值表示加速降温。' }
  ],

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
