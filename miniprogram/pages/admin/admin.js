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
        const reports = res.result.reports.map(r => {
          // 如果数据库没有关键词，尝试从报告中解析
          let keywords = r.keywords || [];
          if (!keywords || keywords.length === 0) {
            keywords = this.parseKeywordsFromReport(r.report);
          }

          return {
            cityName: r.cityName,
            modeLabel: DISPLAY_MODES.find(m => m.value === r.mode)?.label || r.mode,
            time: this.formatDate(r.updateTime || r.createTime),
            keywords: keywords
          };
        });

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
   * 周K线聚合（支持所有6种显示模式）
   */
  aggregateToWeekly(dailyData, mode) {
    if (!dailyData || dailyData.length === 0) return [];

    const weekMap = new Map();

    // 先收集所有数据按周分组
    dailyData.forEach(day => {
      const weekNum = this.getWeekNumber(day.date);
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, {
          dates: [],
          tempMaxList: [],
          tempMinList: [],
          ranges: [],
          avgTemps: []
        });
      }
      const weekData = weekMap.get(weekNum);
      weekData.dates.push(day.date);
      weekData.tempMaxList.push(day.tempMax);
      weekData.tempMinList.push(day.tempMin);
      weekData.ranges.push(day.tempMax - day.tempMin);
      weekData.avgTemps.push((day.tempMax + day.tempMin) / 2);
    });

    // 计算全年统计量（用于某些模式）
    const allAvgTemps = [];
    dailyData.forEach(day => {
      allAvgTemps.push((day.tempMax + day.tempMin) / 2);
    });
    const yearlyAvg = allAvgTemps.reduce((a, b) => a + b, 0) / allAvgTemps.length;
    const yearlyStd = Math.sqrt(
      allAvgTemps.reduce((sum, t) => sum + Math.pow(t - yearlyAvg, 2), 0) / allAvgTemps.length
    );

    // 先生成基础周数据
    const baseWeeklyData = [];
    weekMap.forEach((value, weekNum) => {
      const weekAvg = (Math.max(...value.tempMaxList) + Math.min(...value.tempMinList)) / 2;
      baseWeeklyData.push({
        week: weekNum,
        dates: value.dates,
        tempMaxList: value.tempMaxList,
        tempMinList: value.tempMinList,
        ranges: value.ranges,
        weekAvg: weekAvg
      });
    });

    baseWeeklyData.sort((a, b) => a.week.localeCompare(b.week));

    const weeklyData = [];
    weekMap.forEach((value, weekNum) => {
      const dates = value.dates;
      const tempMaxList = value.tempMaxList;
      const tempMinList = value.tempMinList;
      const ranges = value.ranges;

      let open, close, high, low;

      switch (mode) {
        case 'zscore':
          // Z-score标准化：(温度-均值)/标准差，突出异常周
          const weekZScores = tempMaxList.map(t => (t - yearlyAvg) / yearlyStd);
          const weekMinZScores = tempMinList.map(t => (t - yearlyAvg) / yearlyStd);
          open = weekZScores[0];
          close = weekZScores[weekZScores.length - 1];
          high = Math.max(...weekZScores);
          low = Math.min(...weekMinZScores);
          break;

        case 'weekChange':
          // 环比变化率：(本周-上周)/上周 * 100
          const currentWeekAvg = (Math.max(...tempMaxList) + Math.min(...tempMinList)) / 2;
          const currentIndex = baseWeeklyData.findIndex(d => d.week === weekNum);
          if (currentIndex > 0) {
            const prevWeekAvg = baseWeeklyData[currentIndex - 1].weekAvg;
            const changeRate = ((currentWeekAvg - prevWeekAvg) / prevWeekAvg) * 100;

            const weekAvgList = dates.map((_, i) =>
              (tempMaxList[i] + tempMinList[i]) / 2
            );
            const firstDayAvg = weekAvgList[0];
            const lastDayAvg = weekAvgList[weekAvgList.length - 1];
            open = ((firstDayAvg - prevWeekAvg) / prevWeekAvg) * 100;
            close = ((lastDayAvg - prevWeekAvg) / prevWeekAvg) * 100;
            high = changeRate + 2;
            low = changeRate - 2;
          } else {
            open = 0;
            close = 0;
            high = 5;
            low = -5;
          }
          break;

        case 'cumulative':
          // 累积距平：累积每周与均值的偏差
          const cumIndex = baseWeeklyData.findIndex(d => d.week === weekNum);
          let cumulativeSum = 0;
          for (let i = 0; i <= cumIndex; i++) {
            const w = baseWeeklyData[i];
            cumulativeSum += w.weekAvg - yearlyAvg;
          }

          const weekCumStart = cumIndex > 0 ?
            (cumulativeSum - (baseWeeklyData[cumIndex].weekAvg - yearlyAvg)) : 0;
          open = weekCumStart;
          close = cumulativeSum;
          high = cumulativeSum + 2;
          low = weekCumStart - 1;
          break;

        case 'acceleration':
          // 温度加速度：二阶导数，变化的变化率
          const accIndex = baseWeeklyData.findIndex(d => d.week === weekNum);

          if (accIndex >= 2) {
            const prevWeek2 = baseWeeklyData[accIndex - 2].weekAvg;
            const prevWeek1 = baseWeeklyData[accIndex - 1].weekAvg;
            const currWeek = baseWeeklyData[accIndex].weekAvg;

            const firstChange = prevWeek1 - prevWeek2;
            const secondChange = currWeek - prevWeek1;
            const acceleration = secondChange - firstChange;

            open = firstChange;
            close = secondChange;
            high = acceleration > 0 ? Math.max(firstChange, secondChange) + Math.abs(acceleration) : Math.max(firstChange, secondChange) + 2;
            low = acceleration < 0 ? Math.min(firstChange, secondChange) - Math.abs(acceleration) : Math.min(firstChange, secondChange) - 2;
          } else {
            open = 0;
            close = 0;
            high = 5;
            low = -5;
          }
          break;

        case 'range':
          // 昼夜温差模式
          open = ranges[0];
          close = ranges[ranges.length - 1];
          high = Math.max(...ranges);
          low = Math.min(...ranges);
          break;

        case 'original':
        default:
          // 原始温度模式
          open = tempMinList[0];
          close = tempMinList[tempMinList.length - 1];
          high = Math.max(...tempMaxList);
          low = Math.min(...tempMinList);
          break;
      }

      weeklyData.push({
        week: weekNum,
        date: dates[0],
        open,
        close,
        high,
        low
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
  },

  /**
   * 解析报告中的关键词（兼容旧数据）
   */
  parseKeywordsFromReport(report) {
    if (!report) return [];

    let keywords = [];

    // 尝试多种模式查找 JSON 数组
    let match = report.match(/^\s*\[[\s\S]*?\]\s*(?:\n|$)/);

    if (!match) {
      match = report.match(/\[("[^"]*",?\s*)+\]/);
    }

    if (!match) {
      const jsonMatches = report.match(/\[[^\]]*\]/g);
      if (jsonMatches) {
        for (const m of jsonMatches) {
          try {
            const parsed = JSON.parse(m);
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
              match = [m];
              break;
            }
          } catch (e) {
            // 继续尝试
          }
        }
      }
    }

    if (match) {
      try {
        keywords = JSON.parse(match[0]);
      } catch (e) {
        console.warn('解析关键词失败:', e);
      }
    }

    return keywords;
  }
});
