/**
 * 云函数调用封装
 */
const config = require('./config.js');

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 参数
 * @returns {Promise}
 */
function callCloudFunction(name, data = {}) {
  return wx.cloud.callFunction({
    name,
    data
  }).then(res => {
    if (res.errMsg === 'cloud.callFunction:ok') {
      return res.result;
    }
    throw new Error(res.errMsg);
  }).catch(err => {
    console.error(`云函数调用失败 [${name}]:`, err);
    throw err;
  });
}

/**
 * 获取K线数据
 * @param {string} city 城市英文名（如 'Beijing'）
 * @returns {Promise} 返回日度天气数据
 */
function getKlineData(city) {
  return callCloudFunction(config.CLOUD_FUNCTIONS.GET_KLINE, { city });
}

/**
 * 同步天气数据（初始化用）
 * @returns {Promise}
 */
function syncWeatherData() {
  return callCloudFunction(config.CLOUD_FUNCTIONS.SYNC_WEATHER, {});
}

module.exports = {
  callCloudFunction,
  getKlineData,
  syncWeatherData
};
