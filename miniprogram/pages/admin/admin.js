// pages/admin/admin.js
const { PROVINCE_CAPITALS } = require('../../utils/data.js');
const { DISPLAY_MODES } = require('../../utils/config.js');
const { getKlineData } = require('../../utils/request.js');

Page({
  data: {
    cityCount: PROVINCE_CAPITALS.length,
    modeCount: DISPLAY_MODES.length,
    totalReports: PROVINCE_CAPITALS.length * DISPLAY_MODES.length,
    generating: false,
    progress: 0,
    progressText: '',
    currentCount: 0,
    reportList: [],
    stats: {
      totalReports: 0,
      totalCities: 0,
      totalModes: 0
    }
  },

  onLoad() {
    this.loadReports();
    this.loadStats();
  },

  /**
   * 加载已生成的报告列表
   */
  async loadReports() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'analyze-kline',
        data: {
          action: 'list'
        }
      });

      if (res.result.success) {
        const reports = res.result.reports.map(r => ({
          cityName: r.cityName,
          modeLabel: DISPLAY_MODES.find(m => m.value === r.mode)?.label || r.mode,
          time: this.formatDate(r.updateTime || r.createTime)
        }));

        this.setData({
          reportList: reports.slice(0, 10) // 只显示前10条
        });
      }
    } catch (error) {
      console.error('加载报告列表失败:', error);
    }
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'analyze-kline',
        data: {
          action: 'stats'
        }
      });

      if (res.result.success) {
        this.setData({
          stats: res.result.stats
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  /**
   * 批量生成所有报告
   */
  async onGenerateAll() {
    if (this.data.generating) return;

    wx.showModal({
      title: '确认生成',
      content: `即将生成 ${this.data.totalReports} 份AI分析报告，预计需要 5-15 分钟，是否继续？`,
      confirmText: '开始生成',
      confirmColor: '#667eea',
      success: (res) => {
        if (res.confirm) {
          this.startBatchGeneration();
        }
      }
    });
  },

  /**
   * 开始批量生成
   */
  async startBatchGeneration() {
    this.setData({
      generating: true,
      progress: 0,
      currentCount: 0
    });

    const cities = PROVINCE_CAPITALS;
    const modes = DISPLAY_MODES;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i];

      // 更新进度
      this.setData({
        progressText: `正在生成 ${city.name} 的报告...`,
        progress: Math.round((i / cities.length) * 100)
      });

      try {
        // 获取该城市的K线数据
        const klineResult = await getKlineData(city.en);
        const dailyData = klineResult.data || klineResult;

        // 为每个模式生成报告
        for (let j = 0; j < modes.length; j++) {
          const mode = modes[j];

          // 聚合数据为周K线
          const weeklyData = this.aggregateToWeekly(dailyData, mode.value);

          if (weeklyData.length === 0) {
            console.warn(`${city.name} ${mode.label} 无数据`);
            failCount++;
            continue;
          }

          try {
            // 调用云函数生成报告
            const result = await wx.cloud.callFunction({
              name: 'analyze-kline',
              data: {
                action: 'generate',
                city: city.en,
                cityName: city.name,
                mode: mode.value,
                klineData: weeklyData
              }
            });

            if (result.result.success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (error) {
            console.error(`生成 ${city.name} ${mode.label} 报告失败:`, error);
            failCount++;
          }

          // 更新计数
          this.setData({
            currentCount: i * modes.length + j + 1
          });
        }

        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`获取 ${city.name} 数据失败:`, error);
        failCount += modes.length;
      }
    }

    // 完成
    this.setData({
      generating: false,
      progress: 100,
      progressText: '生成完成！'
    });

    wx.showModal({
      title: '生成完成',
      content: `成功生成 ${successCount} 份报告，失败 ${failCount} 份`,
      showCancel: false,
      success: () => {
        this.loadReports();
        this.loadStats();
      }
    });
  },

  /**
   * 简单的周K线聚合（用于管理页面）
   */
  aggregateToWeekly(dailyData, mode) {
    if (!dailyData || dailyData.length === 0) return [];

    const weekMap = new Map();

    dailyData.forEach(day => {
      const weekNum = this.getWeekNumber(day.date);
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, {
          dates: [],
          tempMaxList: [],
          tempMinList: []
        });
      }
      const weekData = weekMap.get(weekNum);
      weekData.dates.push(day.date);
      weekData.tempMaxList.push(day.tempMax);
      weekData.tempMinList.push(day.tempMin);
    });

    const weeklyData = [];
    weekMap.forEach((value, weekNum) => {
      const { dates, tempMaxList, tempMinList } = value;
      weeklyData.push({
        week: weekNum,
        date: dates[0],
        open: tempMinList[0],
        close: tempMinList[tempMinList.length - 1],
        high: Math.max(...tempMaxList),
        low: Math.min(...tempMinList)
      });
    });

    return weeklyData.sort((a, b) => a.week.localeCompare(b.week));
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
   * 格式化日期
   */
  formatDate(isoString) {
    const date = new Date(isoString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
});
