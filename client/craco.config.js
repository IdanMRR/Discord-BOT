const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add polyfills
      webpackConfig.resolve.fallback = {
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "os": require.resolve("os-browserify/browser"),
        "url": require.resolve("url/"),
        "assert": require.resolve("assert/"),
        "buffer": require.resolve("buffer/"),
        "util": require.resolve("util/"),
        "process": require.resolve("process/browser.js"),
        "zlib": require.resolve("browserify-zlib")
      };

      // Add plugins
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser.js',
          Buffer: ['buffer', 'Buffer']
        }),
        new webpack.DefinePlugin({
          'process.env': JSON.stringify(process.env)
        })
      ];

      return webpackConfig;
    }
  },
  // Configure PostCSS
  style: {
    postcss: {
      loaderOptions: {
        postcssOptions: {
          plugins: [
            require('tailwindcss'),
            require('autoprefixer')
          ]
        }
      }
    }
  }
};
