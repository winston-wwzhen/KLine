/**
 * 数据调试页面
 */
Page({
  data: {
    logs: [],
    city: 'Beijing',
    recordCount: 0,
    sampleData: []
  },

  onLoad() {
    this.checkDatabase();
  },

  checkDatabase() {
    this.addLog('开始查询数据库...');

    wx.cloud.callFunction({
      name: 'get-kline',
      data: {
        city: this.data.city
      }
    }).then(res => {
      const data = res.result.data || res.result;
      this.setData({
        recordCount: data.length,
        sampleData: data.slice(0, 10)
      });
      this.addLog('查询成功，共 ' + data.length + ' 条记录');

      if (data.length > 0) {
        this.addLog('第一条: ' + data[0].date);
        this.addLog('最后一条: ' + data[data.length - 1].date);
      }
    }).catch(err => {
      this.addLog('查询失败: ' + err.message);
    });
  },

  addLog(msg) {
    const now = new Date();
    const time = '' + now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');
    this.setData({
      logs: ['[' + time + '] ' + msg, ...this.data.logs]
    });
  },

  /**
   * 跳转到AI报告管理页面
   */
  goToAIAdmin() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    });
  },

  /**
   * 跳转到数据同步页面
   */
  goToSync() {
    wx.navigateTo({
      url: '/pages/admin/sync/sync'
    });
  }
});
