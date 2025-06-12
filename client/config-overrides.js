module.exports = function override(config) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    http: false,
    https: false,
    os: false,
    url: false,
    assert: false,
    crypto: false,
    stream: false,
    buffer: false,
    util: false,
    zlib: false,
    process: false,
  };

  // Fix for process/browser issue
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];
  
  // Add a rule to handle process/browser references
  config.module.rules.push({
    test: /\.m?js$/,
    include: /node_modules/,
    resolve: {
      alias: {
        'process/browser': 'process'
      }
    }
  });

  return config;
};
