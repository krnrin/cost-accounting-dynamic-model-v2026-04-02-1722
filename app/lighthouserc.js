module.exports = {
  ci: {
    collect: {
      // 构建后的静态文件目录
      staticDistDir: './dist',
      // 测试的 URL 路径
      url: [
        'http://localhost/index.html',
      ],
      // 每个 URL 运行 3 次取中位数
      numberOfRuns: 3,
    },
    assert: {
      // 性能基线设置
      assertions: {
        'categories:performance': ['error', { minScore: 0.7 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
