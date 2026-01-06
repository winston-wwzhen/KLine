/**
 * ec-canvas 组件
 * ECharts for 微信小程序 组件封装
 */
import WxCanvas from './wx-canvas';

let echarts = null;

/**
 * 获取 ECharts
 * 需要用户下载 echarts.min.js 文件放到同目录下
 * 下载地址: https://github.com/ecomfe/echarts-for-weixin
 */
function initECharts() {
  if (!echarts) {
    try {
      echarts = require('./echarts.min.js');
    } catch (e) {
      console.error('请先下载 echarts.min.js 文件');
      console.error('下载地址: https://github.com/ecomfe/echarts-for-weixin');
      throw e;
    }
  }
  return echarts;
}

Component({
  properties: {
    canvasId: {
      type: String,
      default: 'ec-canvas'
    },
    ec: {
      type: Object
    }
  },

  data: {
    isUseNewCanvas: false
  },

  ready: function () {
    if (!this.data.ec) {
      console.warn('请传入 ec 对象');
      return;
    }

    if (!this.data.ec.lazyLoad) {
      this.init();
    }
  },

  methods: {
    init: function (callback) {
      const version = wx.getSystemInfoSync().SDKVersion;

      const canUseNewCanvas = this.compareVersion(version, '2.9.0') >= 0;
      const forceUseOldCanvas = this.data.ec.forceUseOldCanvas;

      const isUseNewCanvas = canUseNewCanvas && !forceUseOldCanvas;
      this.setData({ isUseNewCanvas });

      if (forceUseOldCanvas && canUseNewCanvas) {
        console.warn('建议使用新 Canvas 版本，否则部分功能可能不可用');
      }

      if (isUseNewCanvas) {
        this.initNewCanvas(callback);
      } else {
        this.initOldCanvas(callback);
      }
    },

    initNewCanvas: function (callback) {
      const query = wx.createSelectorQuery().in(this);
      query.select('.ec-canvas')
        .fields({ node: true, size: true })
        .exec(res => {
          if (!res || !res[0]) {
            console.error('未找到 canvas 节点');
            return;
          }

          const canvasNode = res[0].node;
          const canvasContext = canvasNode.getContext('2d');

          const dpr = wx.getSystemInfoSync().pixelRatio;
          const width = res[0].width;
          const height = res[0].height;

          canvasNode.width = width * dpr;
          canvasNode.height = height * dpr;
          canvasContext.scale(dpr, dpr);

          const echarts = initECharts();
          this.chart = echarts.init(canvasNode, null, {
            width: width,
            height: height,
            devicePixelRatio: dpr
          });

          const canvas = new WxCanvas(canvasContext, this.chart, true);

          if (typeof callback === 'function') {
            this.chart.setOption(this.data.ec.option);
            callback(this.chart);
          } else if (this.data.ec.option) {
            this.chart.setOption(this.data.ec.option);
          }

          this.data.ec.onInit && this.data.ec.onInit(this.chart);
        });
    },

    initOldCanvas: function (callback) {
      const ctx = wx.createCanvasContext(this.data.canvasId, this);
      const canvas = new WxCanvas(ctx, null, false);

      const echarts = initECharts();
      this.chart = echarts.init(canvas, null, {
        width: this.data.ec.width,
        height: this.data.ec.height,
        devicePixelRatio: this.data.ec.devicePixelRatio || 1
      });

      canvas.setChart(this.chart);

      if (typeof callback === 'function') {
        this.chart.setOption(this.data.ec.option);
        callback(this.chart);
      } else if (this.data.ec.option) {
        this.chart.setOption(this.data.ec.option);
      }

      this.data.ec.onInit && this.data.ec.onInit(this.chart);
    },

    compareVersion: function (v1, v2) {
      v1 = v1.split('.');
      v2 = v2.split('.');
      const len = Math.max(v1.length, v2.length);

      while (v1.length < len) v1.push('0');
      while (v2.length < len) v2.push('0');

      for (let i = 0; i < len; i++) {
        const num1 = parseInt(v1[i]);
        const num2 = parseInt(v2[i]);

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
      }
      return 0;
    }
  }
});
