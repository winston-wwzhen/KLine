/**
 * 主页面 - K线图展示
 */
const { CITIES } = require('../../utils/cities.js');
const { getKlineData } = require('../../utils/request.js');
const config = require('../../utils/config.js');

Page({
  data: {
    // 城市列表
    cities: CITIES,
    // 当前选中城市
    selectedCity: config.KLINE_CONFIG.DEFAULT_CITY,
    selectedCityName: config.KLINE_CONFIG.DEFAULT_CITY_NAME,
    // 显示模式列表
    displayModes: config.DISPLAY_MODES,
    // 当前显示模式
    displayMode: config.KLINE_CONFIG.DEFAULT_MODE,
    displayModeLabel: '原始温度',
    modeDesc: '',
    // K线数据
    klineData: [],
    // 数据统计
    stats: {
      ups: 0,
      downs: 0,
      maxHigh: 0,
      minLow: 0,
      avgChange: 0,
      totalWeeks: 0,
      dateRange: ''
    },
    // 加载状态
    loading: false,
    // 错误信息
    errorMsg: '',
    // AI分析状态
    analyzing: false,
    analysisReport: '',
    reportKeywords: [],
    reportTime: '',
    showReportModal: false
  },

  onLoad() {
    // 设置初始显示模式标签和说明
    const defaultMode = config.DISPLAY_MODES.find(m => m.value === config.KLINE_CONFIG.DEFAULT_MODE);
    this.setData({
      displayModeLabel: defaultMode ? defaultMode.label : '原始温度',
      modeDesc: defaultMode ? defaultMode.desc : ''
    });

    // 页面加载时获取默认城市的数据
    this.loadKlineData(config.KLINE_CONFIG.DEFAULT_CITY);
  },

  /**
   * 加载K线数据
   */
  loadKlineData(city) {
    this.setData({
      loading: true,
      errorMsg: '',
      analysisReport: '',
      showReportModal: false  // 关闭弹窗
    });

    getKlineData(city).then(result => {
      const dailyData = result.data || result;
      // 根据显示模式聚合成周K线
      const weeklyData = this.aggregateToWeekly(dailyData, this.data.displayMode);
      // 计算统计数据
      const stats = this.calculateStats(weeklyData);
      this.setData({
        klineData: weeklyData,
        stats: stats,
        loading: false,
        analysisReport: '',
        reportKeywords: [],
        showReportModal: false
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
   * @param {Array} dailyData - 日度数据
   * @param {String} mode - 显示模式
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

    const weeklyData = [];

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

    weekMap.forEach((value, weekNum) => {
      const dates = value.dates;
      const tempMaxList = value.tempMaxList;
      const tempMinList = value.tempMinList;
      const ranges = value.ranges;

      let open, close, high, low;

      switch (mode) {
        case 'zscore':
          // Z-score标准化：(温度-均值)/标准差，突出异常周
          // 波动大的城市K线更明显
          const weekZScores = tempMaxList.map(t => (t - yearlyAvg) / yearlyStd);
          const weekMinZScores = tempMinList.map(t => (t - yearlyAvg) / yearlyStd);
          open = weekZScores[0];
          close = weekZScores[weekZScores.length - 1];
          high = Math.max(...weekZScores);
          low = Math.min(...weekMinZScores);
          break;

        case 'weekChange':
          // 环比变化率：(本周-上周)/上周 * 100
          // 不同城市的变化节奏会很不一祥
          const currentWeekAvg = (Math.max(...tempMaxList) + Math.min(...tempMinList)) / 2;
          // 找到上一周的平均温度
          const currentIndex = baseWeeklyData.findIndex(d => d.week === weekNum);
          if (currentIndex > 0) {
            const prevWeekAvg = baseWeeklyData[currentIndex - 1].weekAvg;
            const changeRate = ((currentWeekAvg - prevWeekAvg) / prevWeekAvg) * 100;

            // 用周内变化构造K线
            const weekAvgList = dates.map((_, i) =>
              (tempMaxList[i] + tempMinList[i]) / 2
            );
            const firstDayAvg = weekAvgList[0];
            const lastDayAvg = weekAvgList[weekAvgList.length - 1];
            open = ((firstDayAvg - prevWeekAvg) / prevWeekAvg) * 100;
            close = ((lastDayAvg - prevWeekAvg) / prevWeekAvg) * 100;
            high = changeRate + 2; // 加一些波动
            low = changeRate - 2;
          } else {
            // 第一周，用0作为基准
            open = 0;
            close = 0;
            high = 5;
            low = -5;
          }
          break;

        case 'cumulative':
          // 累积距平：累积每周与均值的偏差
          // 会产生明显的上升/下降趋势
          const cumIndex = baseWeeklyData.findIndex(d => d.week === weekNum);
          let cumulativeSum = 0;
          for (let i = 0; i <= cumIndex; i++) {
            const w = baseWeeklyData[i];
            cumulativeSum += w.weekAvg - yearlyAvg;
          }

          // 本周内的累积变化
          const weekCumStart = cumIndex > 0 ?
            (cumulativeSum - (baseWeeklyData[cumIndex].weekAvg - yearlyAvg)) : 0;
          open = weekCumStart;
          close = cumulativeSum;
          high = cumulativeSum + 2;
          low = weekCumStart - 1;
          break;

        case 'acceleration':
          // 温度加速度：二阶导数，变化的变化率
          // 对温度变化非常敏感
          const accIndex = baseWeeklyData.findIndex(d => d.week === weekNum);

          if (accIndex >= 2) {
            const prevWeek2 = baseWeeklyData[accIndex - 2].weekAvg;
            const prevWeek1 = baseWeeklyData[accIndex - 1].weekAvg;
            const currWeek = baseWeeklyData[accIndex].weekAvg;

            // 二阶差分（加速度）
            const firstChange = prevWeek1 - prevWeek2;
            const secondChange = currWeek - prevWeek1;
            const acceleration = secondChange - firstChange;

            open = firstChange;
            close = secondChange;
            // 用加速度来扩展高低点
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
   * 计算全年平均温度
   */
  calculateYearlyAverage(dailyData) {
    const allTemps = [];
    dailyData.forEach(day => {
      allTemps.push(day.tempMax, day.tempMin);
    });
    const sum = allTemps.reduce((a, b) => a + b, 0);
    return sum / allTemps.length;
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
   * 计算统计数据
   */
  calculateStats(data) {
    if (!data || data.length === 0) {
      return {
        ups: 0,
        downs: 0,
        maxHigh: 0,
        minLow: 0,
        avgChange: 0,
        totalWeeks: 0,
        dateRange: ''
      };
    }

    const ups = data.filter(k => k.close > k.open).length;
    const downs = data.filter(k => k.close < k.open).length;
    const maxHigh = Math.max(...data.map(k => k.high));
    const minLow = Math.min(...data.map(k => k.low));
    const avgChange = data.reduce((sum, k) => sum + (k.close - k.open), 0) / data.length;

    // 获取模式配置以确定单位
    const modeConfig = {
      'original': '°C',
      'zscore': 'σ',
      'weekChange': '%',
      'range': '°C',
      'cumulative': '°C',
      'acceleration': '°C'
    };
    const unit = modeConfig[this.data.displayMode] || '';

    // 格式化时间范围
    const startDate = new Date(data[0].date);
    const endDate = new Date(data[data.length - 1].date);
    const dateRange = `${startDate.getFullYear()}/${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getFullYear()}/${endDate.getMonth() + 1}/${endDate.getDate()}`;

    return {
      ups: ups,
      downs: downs,
      maxHigh: maxHigh.toFixed(1) + unit,
      minLow: minLow.toFixed(1) + unit,
      avgChange: avgChange.toFixed(2) + unit,
      totalWeeks: data.length,
      dateRange: dateRange
    };
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
   * 显示模式选择变化
   */
  onModeChange(e) {
    const index = e.detail.value;
    const mode = this.data.displayModes[index];
    this.setData({
      displayMode: mode.value,
      displayModeLabel: mode.label,
      modeDesc: mode.desc,
      analysisReport: '',
      reportKeywords: [],
      showReportModal: false  // 关闭弹窗
    });
    // 重新加载数据
    this.loadKlineData(this.data.selectedCity);
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadKlineData(this.data.selectedCity);
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  /**
   * 生成AI分析报告
   */
  onGenerateReport() {
    const { selectedCity, displayMode, analyzing } = this.data;

    if (analyzing) return;

    this.setData({ analyzing: true });
    wx.showLoading({
      title: 'AI正在分析...',
      mask: true
    });

    // 先尝试从数据库获取报告
    wx.cloud.callFunction({
      name: 'analyze-kline',
      data: {
        action: 'get',
        city: selectedCity,
        mode: displayMode
      }
    }).then(res => {
      // 假装loading延迟，让用户感觉像是实时生成
      setTimeout(() => {
        wx.hideLoading();

        if (res.result.success) {
          // 使用当前时间作为显示时间（让用户感觉是刚刚生成的）
          const now = new Date();
          const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          // 解析关键词（兼容旧数据：如果数据库没有keywords字段，从报告中提取）
          let keywords = res.result.keywords || [];
          let report = res.result.report || '';

          // 如果数据库没有关键词，尝试从报告中解析
          if (!keywords || keywords.length === 0) {
            const parsed = this.parseKeywordsFromReport(report);
            keywords = parsed.keywords;
            report = parsed.cleanReport;
          }

          this.setData({
            analysisReport: report,
            reportKeywords: keywords,
            reportTime: timeStr,
            analyzing: false,
            showReportModal: true
          });
        } else {
          // 数据库中没有报告
          this.setData({ analyzing: false });
          wx.showModal({
            title: '提示',
            content: '该报告尚未生成，请联系管理员在管理后台生成报告',
            showCancel: false,
            confirmText: '知道了'
          });
        }
      }, 2000); // 假装2秒延迟，让用户感觉像是实时生成
    }).catch(err => {
      wx.hideLoading();
      console.error('获取报告失败:', err);
      this.setData({ analyzing: false });

      wx.showToast({
        title: '获取报告失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 解析报告中的关键词（兼容旧数据）
   */
  parseKeywordsFromReport(report) {
    if (!report) return { keywords: [], cleanReport: '' };

    let keywords = [];
    let cleanReport = report;

    // 先清理常见的 markdown 代码块标记
    cleanReport = cleanReport.replace(/```json\s*/g, '');
    cleanReport = cleanReport.replace(/```\s*/g, '');

    // 尝试多种模式查找 JSON 数组
    // 模式1: 开头的 JSON 数组
    let match = cleanReport.match(/^\s*\[[\s\S]*?\]\s*(?:\n|$)/);

    // 模式2: 任意位置的 JSON 数组（单行）
    if (!match) {
      match = cleanReport.match(/\[("[^"]*",?\s*)+\]/);
    }

    // 模式3: 更宽松的 JSON 数组匹配
    if (!match) {
      const jsonMatches = cleanReport.match(/\[[^\]]*\]/g);
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
        // 从报告中移除关键词部分
        cleanReport = cleanReport.replace(match[0], '').trim();
        // 移除各种分隔符（---, ===, ***, 等）- 全局匹配
        cleanReport = cleanReport.replace(/^[-=*]{3,}\s*\n?/gm, '');
      } catch (e) {
        console.warn('解析关键词失败:', e);
      }
    }

    // 最后清理：移除多余空行（3个或更多连续换行符替换为2个）
    cleanReport = cleanReport.trim().replace(/\n{3,}/g, '\n\n');

    return { keywords, cleanReport };
  },

  /**
   * 关闭报告弹窗
   */
  onCloseReport() {
    this.setData({
      showReportModal: false
    });
  },

  /**
   * 阻止点击冒泡
   */
  onStopPropagation() {
    // 阻止事件冒泡，避免点击弹窗内容时关闭弹窗
  },

  /**
   * 分享报告
   */
  onShareReport() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    wx.showToast({
      title: '点击右上角分享给好友',
      icon: 'none',
      duration: 2000
    });
  },

  /**
   * 分享到好友
   */
  onShareAppMessage() {
    const { selectedCityName, analysisReport } = this.data;

    // 提取报告的关键句作为分享内容
    let shareTitle = `${selectedCityName}年度天气K线分析`;

    if (analysisReport) {
      // 尝试提取标题
      const titleMatch = analysisReport.match(/【(.+?)】/);
      if (titleMatch) {
        shareTitle = titleMatch[1];
      }
    }

    return {
      title: shareTitle,
      path: '/pages/index/index',
      imageUrl: '' // 可以后续生成海报图片
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { selectedCityName, analysisReport } = this.data;

    let shareTitle = `${selectedCityName}年度天气K线分析 - 有意思的数据洞察`;

    if (analysisReport) {
      const titleMatch = analysisReport.match(/【(.+?)】/);
      if (titleMatch) {
        shareTitle = titleMatch[1];
      }
    }

    return {
      title: shareTitle,
      query: '',
      imageUrl: '' // 可以后续生成海报图片
    };
  }
});
