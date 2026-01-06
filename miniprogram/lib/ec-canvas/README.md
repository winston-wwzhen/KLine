# ECharts 集成说明

## 需要下载的文件

请从以下地址下载 ECharts for 微信小程序的库文件：

- GitHub: https://github.com/ecomfe/echarts-for-weixin
- 直接下载: https://github.com/ecomfe/echarts-for-weixin/tree/master/ec-canvas

## 操作步骤

1. 下载 `echarts.min.js` 文件
2. 将文件放到 `miniprogram/lib/ec-canvas/` 目录下
3. 确保目录结构如下：

```
miniprogram/lib/ec-canvas/
├── ec-canvas.js
├── ec-canvas.json
├── ec-canvas.wxml
├── ec-canvas.wxss
├── wx-canvas.js
├── echarts.min.js  ← 需要下载此文件
└── README.md
```

## 推荐方式

从官方示例项目下载：
https://github.com/ecomfe/echarts-for-weixin/tree/master/ec-canvas

或使用定制版本（减小体积）：
https://echarts.apache.org/zh/builder.html
