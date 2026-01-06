/**
 * 主页面 - K线图展示
 */
const { PROVINCE_CAPITALS } = require('../../utils/data.js');
const { getKlineData } = require('../../utils/request.js');
const config = require('../../utils/config.js');

Page({
  data: {
    // 城市列表
    cities: PROVINCE_CAPITALS,
    // 当前选中城市
    selectedCity: config.KLINE_CONFIG.DEFAULT_CITY,
    selectedCityName: config.KLINE_CONFIG.DEFAULT_CITY_NAME,
    // K线数据
    klineData: [],
    // 加载状态
    loading: false,
    // 错误信息
    errorMsg: ''
  },

  onLoad() {
    // 页面加载时获取默认城市的数据
    this.loadKlineData(config.KLINE_CONFIG.DEFAULT_CITY);
  },

  /**
   * 加载K线数据
   */
  loadKlineData(city) {
    this.setData({ loading: true, errorMsg: '' });

    getKlineData(city).then(result => {
      const dailyData = result.data || result;
      // 将日度数据聚合成周K线
      const weeklyData = this.aggregateToWeekly(dailyData);
      this.setData({
        klineData: weeklyData,
        loading: false
      });
    }).catch(err => {
      console.error('获取数据失败:', err);
      this.setData({
        loading: false,
        errorMsg: '数据加载失败，请稍后重试'
      });
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    });
  },

  /**
   * 将每日数据聚合成周K线
   */
  aggregateToWeekly(dailyData) {
    if (!dailyData || dailyData.length === 0) return [];

    const weekMap = new Map();

    dailyData.forEach(day => {
      const weekNum = this.getWeekNumber(day.date);
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, {
          dates: [],
          temps: []
        });
      }
      weekMap.get(weekNum).dates.push(day.date);
      weekMap.get(weekNum).temps.push(day.tempMin, day.tempMax);
    });

    const weeklyData = [];

    weekMap.forEach((value, weekNum) => {
      const dates = value.dates;
      const temps = value.temps;

      // 周一最低温 = 开盘价
      const open = temps[0];
      // 周日最低温 = 收盘价
      const close = temps[temps.length - 2];
      // 本周最高温 = 最高价
      const high = Math.max(...temps);
      // 本周最低温 = 最低价
      const low = Math.min(...temps);

      weeklyData.push({
        week: weekNum,
        date: dates[0],
        open,
        close,
        high,
        low
      });
    });

    return weeklyData.sort((a, b) => a.week - b.week);
  },

  /**
   * 获取周数
   */
  getWeekNumber(dateStr) {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const numberOfDays = Math.floor((date - oneJan) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((date.getDay() + 1 + numberOfDays) / 7);
    return `${year}-W${weekNum}`;
  },

  /**
   * 城市选择变化
   */
  onCityChange(e) {
    const index = e.detail.value;
    const city = this.data.cities[index];
    this.setData({
      selectedCity: city.en,
      selectedCityName: city.name
    });
    this.loadKlineData(city.en);
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadKlineData(this.data.selectedCity);
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  }
});
