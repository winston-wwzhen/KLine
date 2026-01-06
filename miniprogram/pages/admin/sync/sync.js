/**
 * 数据同步管理页面
 */
Page({
  data: {
    // 同步状态
    syncing: false,
    // 当前进度
    currentBatch: 0,
    totalBatches: 11,
    progress: 0,
    // 日志
    logs: [],
    // 统计
    stats: {
      totalCities: 31,
      syncedCities: 0,
      failedCities: 0,
      totalRecords: 0
    },
    // 当前正在处理的城市
    currentCities: []
  },

  /**
   * 开始同步
   */
  async startSync() {
    if (this.data.syncing) {
      return;
    }

    this.setData({
      syncing: true,
      currentBatch: 0,
      progress: 0,
      logs: [],
      stats: {
        totalCities: 31,
        syncedCities: 0,
        failedCities: 0,
        totalRecords: 0
      }
    });

    this.addLog('开始同步天气数据...');
    this.addLog('总计 31 个城市，分 11 批处理');

    let startIndex = 0;
    const count = 3;

    try {
      while (startIndex !== null && this.data.syncing) {
        const result = await this.syncBatch(startIndex, count);

        if (!result.success) {
          this.addLog('❌ 同步失败: ' + (result.errorMsg || '未知错误'));
          break;
        }

        // 更新统计
        const stats = this.data.stats;
        stats.syncedCities += result.summary.successCount;
        stats.failedCities += result.summary.failCount;

        // 更新进度
        this.setData({
          currentBatch: Math.floor(result.batch.endIndex / count),
          progress: parseInt(result.batch.progress),
          stats: stats
        });

        // 检查是否还有下一批
        startIndex = result.nextStartIndex;

        // 等待1秒后继续（避免云函数调用过快）
        if (startIndex !== null) {
          await this.sleep(1000);
        }
      }

      if (this.data.syncing) {
        this.addLog('🎉 同步完成！');
        this.addLog(`✅ 成功: ${this.data.stats.syncedCities} 个城市`);
        this.addLog(`❌ 失败: ${this.data.stats.failedCities} 个城市`);
      }

    } catch (err) {
      this.addLog('❌ 同步异常: ' + err.message);
      console.error(err);
    } finally {
      this.setData({
        syncing: false
      });
    }
  },

  /**
   * 同步一批数据
   */
  syncBatch(startIndex, count) {
    return new Promise((resolve, reject) => {
      this.addLog(`正在同步第 ${startIndex + 1}-${startIndex + count} 个城市...`);

      wx.cloud.callFunction({
        name: 'sync-weather',
        data: {
          startIndex: startIndex,
          count: count
        }
      }).then(res => {
        if (res.errMsg !== 'cloud.callFunction:ok') {
          reject(new Error(res.errMsg));
          return;
        }

        const result = res.result;
        this.addLog(`✅ 批次完成: ${result.batch.progress}`);

        if (result.summary.failCount > 0) {
          result.errors.forEach(err => {
            this.addLog(`⚠️ ${err.city}: ${err.error}`);
          });
        }

        resolve(result);
      }).catch(err => {
        reject(err);
      });
    });
  },

  /**
   * 停止同步
   */
  stopSync() {
    this.addLog('⚠️ 用户中断同步');
    this.setData({
      syncing: false
    });
  },

  /**
   * 添加日志
   */
  addLog(message) {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const logs = this.data.logs;
    logs.push(`[${time}] ${message}`);

    // 只保留最近50条日志
    if (logs.length > 50) {
      logs.shift();
    }

    this.setData({
      logs: logs
    });

    // 滚动到底部
    this.scrollToBottom();
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    wx.createSelectorQuery()
      .select('#log-container')
      .boundingClientRect(rect => {
        if (rect) {
          wx.pageScrollTo({
            scrollTop: rect.bottom,
            duration: 300
          });
        }
      })
      .exec();
  },

  /**
   * 延迟函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 清空日志
   */
  clearLogs() {
    this.setData({
      logs: []
    });
  }
});
