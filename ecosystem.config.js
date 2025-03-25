module.exports = {
  apps: [{
    name: 'ai-reading',
    script: 'server.js',
    watch: true,
    ignore_watch: ['node_modules', 'uploads', 'public'],
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
}; 