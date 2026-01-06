/**
 * 简单 K 线图组件 - 使用原生 Canvas API
 */
Component({
  properties: {
    klineData: {
      type: Array,
      value: []
    },
    displayMode: {
      type: String,
      value: 'original'
    }
  },

  data: {
    canvasWidth: 0,
    canvasHeight: 0
  },

  observers: {
    'klineData': function(newData) {
      if (newData && newData.length > 0) {
        this.drawChart(newData);
      }
    }
  },

  methods: {
    /**
     * 获取模式配置
     */
    getModeConfig(mode) {
      const configs = {
        'original': { title: '天气周K线图 (原始温度)', unit: '°C' },
        'zscore': { title: '天气周K线图 (Z-score标准化)', unit: 'σ' },
        'weekChange': { title: '天气周K线图 (环比变化率)', unit: '%' },
        'range': { title: '天气周K线图 (昼夜温差)', unit: '°C' },
        'cumulative': { title: '天气周K线图 (累积距平)', unit: '°C' },
        'acceleration': { title: '天气周K线图 (温度加速度)', unit: '°C' }
      };
      return configs[mode] || configs['original'];
    },

    /**
     * 绘制 K 线图
     */
    drawChart(data) {
      const query = wx.createSelectorQuery().in(this);
      query.select('#kline-canvas')
        .fields({ node: true, size: true })
        .exec(res => {
          if (!res || !res[0]) {
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;

          const width = res[0].width;
          const height = res[0].height;

          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          this.setData({
            canvasWidth: width,
            canvasHeight: height
          });

          this.renderCandlestick(ctx, data, width, height);
        });
    },

    /**
     * 渲染蜡烛图
     */
    renderCandlestick(ctx, data, width, height) {
      // 清空画布
      ctx.clearRect(0, 0, width, height);

      // 配置
      const padding = { top: 40, right: 40, bottom: 40, left: 50 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      // 获取模式配置
      const modeConfig = this.getModeConfig(this.data.displayMode);

      // 计算极值
      let minPrice = Infinity;
      let maxPrice = -Infinity;

      data.forEach(item => {
        minPrice = Math.min(minPrice, item.low);
        maxPrice = Math.max(maxPrice, item.high);
      });

      // 增加一点边距
      const priceRange = maxPrice - minPrice;
      minPrice -= priceRange * 0.1;
      maxPrice += priceRange * 0.1;

      // 绘制网格线
      this.drawGrid(ctx, width, height, padding);

      // 绘制坐标轴
      this.drawAxes(ctx, width, height, padding, data, minPrice, maxPrice, modeConfig.unit);

      // 绘制 K 线
      const candleWidth = chartWidth / data.length * 0.6;
      const gap = chartWidth / data.length * 0.4;

      data.forEach((item, index) => {
        const x = padding.left + index * (candleWidth + gap) + gap / 2;

        // 计算价格对应的 Y 坐标
        const openY = padding.top + chartHeight - ((item.open - minPrice) / (maxPrice - minPrice)) * chartHeight;
        const closeY = padding.top + chartHeight - ((item.close - minPrice) / (maxPrice - minPrice)) * chartHeight;
        const highY = padding.top + chartHeight - ((item.high - minPrice) / (maxPrice - minPrice)) * chartHeight;
        const lowY = padding.top + chartHeight - ((item.low - minPrice) / (maxPrice - minPrice)) * chartHeight;

        // 判断涨跌
        const isUp = item.close >= item.open;
        const color = isUp ? '#ef5350' : '#26a69a';

        // 绘制影线
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // 绘制实体
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.abs(closeY - openY) || 1;

        ctx.fillStyle = color;
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

        // 绘制边框
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      });

      // 绘制标题
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(modeConfig.title, width / 2, 20);
    },

    /**
     * 绘制网格线
     */
    drawGrid(ctx, width, height, padding) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;

      // 水平网格线
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (height - padding.top - padding.bottom) * i / 5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      // 垂直网格线
      for (let i = 0; i <= 6; i++) {
        const x = padding.left + (width - padding.left - padding.right) * i / 6;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, height - padding.bottom);
        ctx.stroke();
      }
    },

    /**
     * 绘制坐标轴
     */
    drawAxes(ctx, width, height, padding, data, minPrice, maxPrice, unit) {
      const chartHeight = height - padding.top - padding.bottom;
      const chartWidth = width - padding.left - padding.right;

      // 绘制Y轴线条
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top);
      ctx.lineTo(padding.left, height - padding.bottom);
      ctx.stroke();

      // 绘制X轴线条
      ctx.beginPath();
      ctx.moveTo(padding.left, height - padding.bottom);
      ctx.lineTo(width - padding.right, height - padding.bottom);
      ctx.stroke();

      // Y轴刻度
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= 5; i++) {
        const value = minPrice + (maxPrice - minPrice) * (1 - i / 5);
        const y = padding.top + chartHeight * i / 5;
        ctx.fillText(value.toFixed(1) + unit, padding.left - 5, y);
      }

      // X轴刻度（每7个显示一个）
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (let i = 0; i < data.length; i += 7) {
        const x = padding.left + chartWidth * i / data.length + chartWidth / data.length / 2;
        const date = new Date(data[i].date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(label, x, height - padding.bottom + 5);
      }
    }
  }
});
