/**
 * wx-canvas.js
 * Canvas 适配器
 */
export default class WxCanvas {
  constructor(ctx, canvasId, isNew) {
    this.ctx = ctx;
    this.canvasId = canvasId;
    this.chart = null;
    this.isNew = isNew;

    if (isNew) {
      this.canvas = canvasId;
    }
  }

  setChart(chart) {
    this.chart = chart;
  }

  getContext(contextType) {
    if (contextType === '2d') {
      return this.ctx;
    }
  }

  // 模拟 Canvas 的添加事件监听
  addEventListener() {}

  // 触摸事件处理
  touch(e, ownerInstance) {
    if (this.chart && e.touches.length > 0) {
      const touch = e.touches[0];
      const touchEvent = {
        x: touch.x,
        y: touch.y
      };

      if (this.isNew) {
        this.chart._zr.handler.dispatch('mousedown', touchEvent);
        this.chart._zr.handler.dispatch('mousemove', touchEvent);
        this.chart._zr.handler.processGesture(wrapTouch(e), 'change');
      } else {
        const handler = this.chart.getZr().handler;
        handler.dispatch('mousedown', touchEvent);
        handler.dispatch('mousemove', touchEvent);
        handler.processGesture(wrapTouch(e), 'change');
      }
    }
  }
}

function wrapTouch(event) {
  for (let i = 0; i < event.touches.length; ++i) {
    const touch = event.touches[i];
    touch.offsetX = touch.x;
    touch.offsetY = touch.y;
  }
  return event;
}
