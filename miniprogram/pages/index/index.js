/**
 * 主页面 - K线图展示
 */
const { PROVINCE_CAPITALS } = require('../../utils/data.js');
const { getKlineData } = require('../../utils/request.js');
const config = require('../../utils/config.js');
const echarts = require('../../lib/ec-canvas/echarts.min.js');

let chart = null;

function initChart(canvas, width, height, canvasDpr) {
  chart = echarts.init(canvas, null, {
    width: width,
    height: height,
    devicePixelRatio: canvasDpr
  });
  canvas.setChart(chart);
  return chart;
}

Page({
  data: {
    // 城市列表
    cities: PROVINCE_CAPITALS,
    // 城市索引列表（用于picker右侧快速定位）
    cityIndex: [0, 0, 0],
    // 当前选中城市
    selectedCity: config.KLINE_CONFIG.DEFAULT_CITY,
    selectedCityName: config.KLINE_CONFIG.DEFAULT_CITY_NAME,
    // K线数据
    klineData: [],
    // 加载状态
    loading: false,
    // 错误信息
    errorMsg: '',
    // ECharts 配置
    ec: {
      onInit: initChart
    }
  },

  onLoad() {
    // 页面加载时获取默认城市的数据
    this.loadKlineData(config.KLINE_CONFIG.DEFAULT_CITY);
  },

  /**
   * 加载K线数据
   * @param {string} city 城市英文名
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
      // 更新图表
      this.updateChart(weeklyData);
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
   * 更新图表
   */
  updateChart(klineData) {
    if (!chart) return;

    const option = this.getOption(klineData);
    chart.setOption(option);
  },

  /**
   * 获取 ECharts 配置
   */
  getOption(klineData) {
    // 转换数据格式为 ECharts candlestick 需要的格式
    const data = klineData.map(item => {
      return [item.open, item.close, item.low, item.high];
    });

    // X轴日期
    const dates = klineData.map(item => {
      const date = new Date(item.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    return {
      animation: true,
      grid: {
        left: '10%',
        right: '8%',
        top: '15%',
        bottom: '15%'
      },
      xAxis: {
        type: 'category',
        data: dates,
        scale: true,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        axisLabel: {
          fontSize: 10
        }
      },
      yAxis: {
        scale: true,
        splitArea: {
          show: true
        },
        axisLabel: {
          formatter: '{value}°C',
          fontSize: 10
        }
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100
        },
        {
          show: true,
          type: 'slider',
          top: '90%',
          start: 0,
          end: 100
        }
      ],
      series: [{
        name: '天气K线',
        type: 'candlestick',
        data: data,
        itemStyle: {
          color: config.KLINE_CONFIG.COLORS.UP,       // 阳线颜色（上涨）
          color0: config.KLINE_CONFIG.COLORS.DOWN,    // 阴线颜色（下跌）
          borderColor: config.KLINE_CONFIG.COLORS.UP,
          borderColor0: config.KLINE_CONFIG.COLORS.DOWN
        }
      }],
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: function(params) {
          const item = klineData[params[0].dataIndex];
          if (!item) return '';

          return `
            ${item.date}
            开盘: ${item.open}°C
            收盘: ${item.close}°C
            最高: ${item.high}°C
            最低: ${item.low}°C
          `;
        }
      },
      title: {
        text: '天气周K线图',
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 14
        }
      }
    };
  },

  /**
   * 将每日数据聚合成周K线
   * @param {Array} dailyData 日度数据
   * @returns {Array} 周K线数据
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
        date: dates[0], // 周一日期作为显示
        open,
        close,
        high,
        low
      });
    });

    // 按周数排序
    return weeklyData.sort((a, b) => a.week - b.week);
  },

  /**
   * 获取周数
   * @param {string} dateStr 日期字符串 YYYY-MM-DD
   * @returns {string} 周数标识
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
