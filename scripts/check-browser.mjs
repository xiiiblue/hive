// 静态网站浏览器验证。运行方法见docs/内容维护.md。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const playwrightPath = process.env.HIVE_SITE_PLAYWRIGHT;
const chromePath = process.env.HIVE_SITE_CHROME;
if (!playwrightPath || !chromePath) {
  throw new Error('请设置HIVE_SITE_PLAYWRIGHT和HIVE_SITE_CHROME，分别指向Playwright模块和Chrome可执行文件。');
}
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const origin = process.env.HIVE_SITE_PREVIEW ?? 'http://127.0.0.1:4328';
const output = resolve('.verification');
const errors = [];
const requests = [];
const checks = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  locale: 'zh-CN',
  reducedMotion: 'reduce',
  colorScheme: 'light',
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400) requests.push({ status: response.status(), url: response.url() });
});

async function shot(name) {
  await page.screenshot({ path: resolve(output, name + '-viewport.png'), fullPage: false, animations: 'disabled' });
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage: true, animations: 'disabled' });
}

async function go(path) {
  const response = await page.goto(origin + '/hive' + path, { waitUntil: 'networkidle' });
  assert(response?.ok(), '可以打开：' + path);
  await page.locator('main h1').first().waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '页面无横向溢出：' + path);
}

async function openDirectory() {
  const diagram = page.frameLocator('iframe[title="蜂巢功能架构与功能目录"]');
  assert.deepEqual(await diagram.locator('.architecture > .layer > h2').allTextContents(), [
    '使用入口', '员工应用', '企业管理', '系统接入', '平台支撑',
  ]);
  const query = diagram.getByRole('searchbox', { name: '按关键词搜索' });
  const role = diagram.getByRole('combobox', { name: '按角色筛选' });
  await query.waitFor();
  const all = await diagram.locator('.entry:visible').count();
  await query.fill('知识库');
  await role.selectOption('admin');
  const matches = diagram.locator('.entry:visible');
  const count = await matches.count();
  assert(count > 0 && count < all);
  assert.equal(await matches.locator('xpath=self::li[contains(@data-roles, "admin")]').count(), count);
  assert.match(await diagram.getByRole('status').textContent(), /显示\d+项功能/);
  await diagram.getByRole('button', { name: '清除筛选' }).click();
  assert.equal(await query.inputValue(), '');
  assert.equal(await role.inputValue(), '');
  assert.equal(await matches.count(), all);
  const standalone = page.getByRole('link', { name: '在新窗口打开' });
  assert.equal(await standalone.getAttribute('href'), '/hive/media/diagrams/capabilities.html');
  assert.equal(await standalone.getAttribute('target'), '_blank');
  const noOverflow = await query.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert(noOverflow, '功能目录宽度随阅读区适配');
}

try {
  for (const [path, name] of [
    ['/', 'home'], ['/product/', 'product'], ['/architecture/', 'architecture'],
    ['/handbooks/', 'handbooks'], ['/developers/', 'developers'], ['/docs/', 'docs'],
    ['/docs/employee/02-conversations/', 'employee'], ['/docs/admin/overview/', 'admin'],
    ['/docs/developers/open-api/', 'api'], ['/docs/product/capabilities/', 'capabilities'],
  ]) {
    await go(path);
    await shot(name + '-desktop');
  }
  await openDirectory();
  checks.push('桌面首页、手册、文档、架构、开发对接与功能目录');
  await go('/');
  await page.getByRole('tab', { name: '继续已有工作' }).click();
  assert(await page.locator('#example-files').isVisible());
  await page.keyboard.press('ArrowRight');
  assert(await page.locator('#example-panels').isVisible());
  await go('/architecture/');
  await page.getByRole('tab', { name: '模型访问' }).click();
  assert(await page.locator('#layer-panel-model').isVisible());
  checks.push('首页场景和架构职责切换');

  await go('/');
  await page.getByRole('button', { name: '搜索全部文档' }).click();
  const search = page.getByRole('searchbox');
  await search.fill('绑定');
  await page.locator('.search-result').first().waitFor();
  await shot('search-results');
  assert(await page.locator('.search-result').count() > 3);
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('.search-result.is-selected').count(), 1);
  await search.fill('不存在的蜂巢检索词ZZZZ');
  await page.getByText('没有找到相关内容', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#site-search').isVisible(), false);
  await page.keyboard.press('Meta+k');
  await page.locator('#site-search').waitFor();
  await search.fill('Idempotency-Key');
  await page.locator('.search-result').first().waitFor();
  await page.keyboard.press('Escape');
  checks.push('公开文档搜索、无结果与键盘快捷键');

  await go('/docs/employee/02-conversations/');
  const zoom = page.locator('[data-image-zoom]').first();
  await zoom.click();
  await page.locator('#image-lightbox').waitFor();
  assert((await page.locator('#lightbox-image').getAttribute('src'))?.includes('/hive/media/'));
  const actualSize = page.getByRole('button', { name: '原始尺寸' });
  await actualSize.click();
  assert.equal(await actualSize.getAttribute('aria-pressed'), 'true');
  await actualSize.click();
  assert.equal(await actualSize.getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#image-lightbox').isVisible(), false);
  assert(await zoom.evaluate(node => document.activeElement === node));
  await page.locator('.doc-toc nav a').first().click();
  assert(await page.evaluate(() => location.hash.length > 0));
  await page.emulateMedia({ media: 'print' });
  assert.equal(await page.locator('.site-header').isVisible(), false);
  assert.equal(await page.locator('.doc-sidebar').isVisible(), false);
  assert(await page.locator('.doc-content').isVisible());
  await page.emulateMedia({ media: 'screen' });
  checks.push('图片适屏和原始尺寸、关闭后焦点返回、固定目录定位和打印正文');

  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await go('/');
    await page.screenshot({ path: resolve(output, 'home-width-' + width + '.png'), fullPage: true, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, name] of [
    ['/', 'home'], ['/architecture/', 'architecture'], ['/handbooks/', 'handbooks'],
    ['/docs/employee/02-conversations/', 'employee'], ['/docs/developers/identity/', 'identity'],
    ['/docs/product/capabilities/', 'capabilities'],
  ]) {
    await go(path);
    await shot(name + '-mobile');
  }
  await openDirectory();
  await go('/docs/employee/02-conversations/');
  await page.locator('.mobile-doc-nav summary').click();
  assert(await page.locator('.mobile-doc-nav a[aria-current=page]').isVisible());
  await page.locator('.mobile-doc-nav summary').click();
  await page.locator('.compact-toc summary').click();
  await page.locator('.compact-toc nav a').first().click();
  assert(await page.evaluate(() => location.hash.length > 0));
  assert.equal(await page.locator('.compact-toc').getAttribute('open'), null);
  checks.push('390px移动阅读、紧凑章节与本页目录、320/768/1024px首页、桌面和移动端目录筛选');

  await go('/');
  const menu = page.getByRole('button', { name: '展开导航' });
  await menu.click();
  assert(await page.getByRole('navigation', { name: '手机导航' }).getByRole('link', { name: '功能目录' }).isVisible());
  await shot('mobile-navigation');
  await menu.click();
  await page.getByRole('button', { name: '切换明暗主题' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await shot('home-dark-mobile');
  await page.reload();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await go('/docs/product/capabilities/');
  const diagramBody = page.frameLocator('iframe').locator('body');
  const darkBackground = await diagramBody.evaluate(node => getComputedStyle(node).backgroundColor);
  await page.getByRole('button', { name: '切换明暗主题' }).click();
  const lightBackground = await diagramBody.evaluate(node => getComputedStyle(node).backgroundColor);
  assert.notEqual(darkBackground, lightBackground, '嵌入的功能目录随正文切换主题');
  await page.getByRole('button', { name: '切换明暗主题' }).click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await go('/docs/architecture/security/');
  await shot('reading-dark-desktop');
  checks.push('移动导航、暗色主题及刷新保留、嵌入目录主题跟随');

  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await writeFile(resolve(output, 'browser-result.json'), JSON.stringify({ result: 'passed', checks, errors, requests }, null, 2));
  console.log('浏览器检查通过');
} catch (error) {
  await writeFile(resolve(output, 'browser-result.json'), JSON.stringify({ result: 'failed', checks, errors, requests, failure: String(error) }, null, 2));
  throw error;
} finally {
  await browser.close();
}
