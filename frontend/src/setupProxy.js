const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      // Keep the browser's Host header: the backend rejects anything but localhost (DNS rebinding).
      target: 'http://localhost:5000',
    })
  );
};
