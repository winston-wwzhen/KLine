/**
 * kline-chart 组件
 * K线图组件，封装 ECharts 配置
 */
const config = require('../../utils/config.js');

Component({
  properties: {
    // K线数据
    klineData: {
      type: Array,
      value: []
    }
  },

  data: {
    ec: {
      onInit: null,
      lazyLoad: true
    }
  },

  observers: {
    'klineData': function(newData) {
      if (newData && newData.length > 0 && this.chart) {
        this.updateChart(newData);
      }
    }
  },

  methods: {
    /**
     * 初始化图表
     */
    initChart(canvas, width, height, canvasDpr) {
      const echarts = require('../../lib/ec-canvas/echarts.min.js');

      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: canvasDpr
      });

      canvas.setChart(chart);
      this.chart = chart;

      // 初始设置为空配置
      chart.setOption(this.getOption([]));

      return chart;
    },

    /**
     * 更新图表数据
     */
    updateChart(klineData) {
      if (!this.chart) return;

      const option = this.getOption(klineData);
      this.chart.setOption(option);
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
        animation: false,
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
          },
          markPoint: {
            data: [
              { type: 'max', name: '最大值' },
              { type: 'min', name: '最小值' }
            ]
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
              <div style="padding: 8px;">
                <div style="margin-bottom: 5px;">${item.date}</div>
                <div>开盘: ${item.open}°C</div>
                <div>收盘: ${item.close}°C</div>
                <div>最高: ${item.high}°C</div>
                <div>最低: ${item.low}°C</div>
              </div>
            `;
          }
        },
        title: {
          text: '天气周K线图',
          left: 'center',
          top: 10
        }
      };
    }
  }
});
