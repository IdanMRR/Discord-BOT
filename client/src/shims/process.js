// Custom process shim
const processShim = {
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development'
  },
  browser: true,
  version: '',
  nextTick: function(cb) {
    setTimeout(cb, 0);
  }
};

module.exports = processShim;
