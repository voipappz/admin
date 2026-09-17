// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

// Resolve a Chrome/Chromium binary for the headless test run.
// Order of preference:
//   1. CHROME_BIN from the environment (explicit override)
//   2. A modern Playwright-managed Chromium (the CI Docker image and local
//      dev both ship one) — needed because puppeteer's bundled Chrome 93 is
//      too old to parse the app's modern JS bundle (SyntaxError, 0 tests run)
//   3. puppeteer's bundled Chrome (last-resort fallback)
function resolveChromeBin() {
  const fs = require('fs');
  const path = require('path');
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  // Look for the newest Playwright Chromium build.
  const candidates = [];
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,           // CI image (/ms-playwright)
    path.join(require('os').homedir(), '.cache', 'ms-playwright'), // local
  ].filter(Boolean);
  for (const root of roots) {
    try {
      for (const dir of fs.readdirSync(root)) {
        if (!dir.startsWith('chromium-')) continue;
        for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          const bin = path.join(root, dir, rel);
          if (fs.existsSync(bin)) {
            // Sort key: numeric build suffix, newest wins.
            const build = parseInt(dir.split('-')[1], 10) || 0;
            candidates.push({ build, bin });
          }
        }
      }
    } catch (e) { /* root missing — ignore */ }
  }
  if (candidates.length) {
    candidates.sort((a, b) => b.build - a.build);
    return candidates[0].bin;
  }
  // Fallback: puppeteer's bundled Chrome (may be too old for modern syntax).
  try { return require('puppeteer').executablePath(); } catch (e) { return undefined; }
}

process.env.CHROME_BIN = resolveChromeBin();

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    coverageIstanbulReporter: {
      dir: require('path').join(__dirname, 'coverage'),
      reports: ['html', 'lcovonly'],
      fixWebpackSourcePaths: true
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome', 'ChromeHeadless'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu']
      }
    },
    singleRun: false
  });
};
