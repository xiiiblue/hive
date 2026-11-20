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
  const diagram = page.locator('main .capabilities-sheet');
  assert.equal(await page.locator('iframe, .doc-sidebar, .doc-toc').count(), 0);
  assert.equal(await page.locator('main h1').count(), 1);
  assert.equal(await page.locator('.desktop-nav a[aria-current=page]').textContent(), '功能');
  assert(await diagram.evaluate(node => getComputedStyle(node).backgroundColor === getComputedStyle(document.body).backgroundColor),
    '功能页沿用官网底色');
  const title = diagram.locator('.page-intro h1');
  const figure = diagram.locator('.architecture');
  assert(Math.abs((await title.boundingBox()).x - (await figure.boundingBox()).x) < 1,
    '功能页标题与功能架构图共用内容边距');
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
  const guide = diagram.getByRole('region', { name: '按任务查操作手册' });
  assert.deepEqual(await guide.getByRole('heading', { level: 3 }).allTextContents(), ['员工工作台', '管理员控制台', '开发对接']);
  const catalog = await diagram.locator('.catalog').boundingBox();
  const lastGroup = await diagram.locator('.catalog .bucket:visible').last().boundingBox();
  const guideBounds = await guide.boundingBox();
  assert(Math.abs(catalog.x - guideBounds.x) < 1 && Math.abs(catalog.width - guideBounds.width) < 1, '功能目录和手册入口左右对齐');
  assert(Math.abs(catalog.width - lastGroup.width) < 1, '最后一组功能铺满整行');
  await diagram.getByRole('link', { name: '查找详细功能' }).click();
  assert.equal(new URL(page.url()).hash, '#features');
  await diagram.getByRole('link', { name: '返回页首' }).click();
  assert.equal(new URL(page.url()).hash, '#top');
  const noOverflow = await query.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert(noOverflow, '功能目录宽度随阅读区适配');
  await page.emulateMedia({ media: 'print' });
  assert(await figure.isVisible());
  assert.equal(await diagram.locator('.diagram-actions').isVisible(), false);
  assert.equal(await query.isVisible(), false);
  await page.emulateMedia({ media: 'screen' });
}

try {
  for (const [path, name] of [
    ['/', 'home'], ['/product/', 'product'], ['/architecture/', 'architecture'],
    ['/handbooks/', 'handbooks'], ['/developers/', 'developers'], ['/docs/', 'docs'],
    ['/docs/employee/02-conversations/', 'employee'], ['/docs/admin/overview/', 'admin'],
    ['/docs/developers/open-api/', 'api'], ['/capabilities/', 'capabilities'],
  ]) {
    await go(path);
    await shot(name + '-desktop');
  }
  await openDirectory();
  await page.goto(origin + '/hive/docs/product/capabilities/?from=bookmark#features');
  await page.waitForURL('**/hive/capabilities/?from=bookmark#features');
  await page.locator('#features:target').waitFor();
  checks.push('桌面首页、手册、文档、架构、开发对接与功能目录');
  await go('/product/');
  const desktopNav = page.getByRole('navigation', { name: '主导航' });
  assert.deepEqual((await desktopNav.getByRole('link').allTextContents()).slice(0, 2), ['首页', '产品']);
  assert.equal(await desktopNav.locator('[aria-current=page]').textContent(), '产品');
  const desktopHome = desktopNav.getByRole('link', { name: '首页', exact: true });
  await desktopHome.click();
  await page.waitForURL(origin + '/hive/');
  assert.equal(await desktopHome.getAttribute('aria-current'), 'page');
  assert.equal(await page.getByRole('tablist', { name: '工作场景' }).getAttribute('aria-orientation'), 'horizontal');
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
    ['/capabilities/', 'capabilities'],
  ]) {
    await go(path);
    await shot(name + '-mobile');
  }
  await go('/');
  assert.equal(await page.getByRole('tablist', { name: '工作场景' }).getAttribute('aria-orientation'), 'horizontal');
  await go('/capabilities/');
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

  await go('/product/');
  const menu = page.getByRole('button', { name: '展开导航' });
  await menu.click();
  const mobileNav = page.getByRole('navigation', { name: '手机导航' });
  assert(await mobileNav.getByRole('link', { name: '功能', exact: true }).isVisible());
  const mobileHome = mobileNav.getByRole('link', { name: '首页', exact: true });
  assert.equal(await mobileHome.getAttribute('aria-current'), null);
  await mobileHome.click();
  await page.waitForURL(origin + '/hive/');
  await menu.click();
  assert.equal(await mobileHome.getAttribute('aria-current'), 'page');
  await shot('mobile-navigation');
  await menu.click();
  await page.evaluate(() => localStorage.setItem('hive-site-theme', 'dark'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  assert.equal(await page.getByRole('button', { name: '切换明暗主题' }).count(), 0);
  assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).colorScheme), 'light',
    '手机在深色系统和旧主题设置下仍使用官网固定配色');
  await shot('home-mobile-fixed-palette');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await go('/docs/architecture/security/');
  assert.equal(await page.getByRole('button', { name: '切换明暗主题' }).count(), 0);
  assert.equal(await page.locator('html').evaluate(node => getComputedStyle(node).colorScheme), 'light');
  await go('/capabilities/');
  assert.equal(await page.locator('.capabilities-sheet').evaluate(node => getComputedStyle(node).colorScheme), 'light');
  for (const file of ['capabilities', 'system-architecture', 'employee-digital-twin', 'workspace-continuity']) {
    await go('/media/diagrams/' + file + '.html');
    const colors = await page.locator('body').evaluate(node => {
      const style = getComputedStyle(node);
      return { scheme: style.colorScheme, background: style.backgroundColor };
    });
    assert.deepEqual(colors, {
      scheme: 'light',
      background: file === 'capabilities' ? 'rgb(242, 246, 252)' : 'rgb(234, 240, 247)',
    }, '独立打开原图时保持浅底阅读配色');
  }
  await page.emulateMedia({ colorScheme: 'light' });
  checks.push('桌面与手机返回首页、深色系统和旧设置下官网及独立架构图配色一致');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const previousScene = page.getByRole('button', { name: '上一个工作场景' });
  const nextScene = page.getByRole('button', { name: '下一个工作场景' });
  const scenePosition = page.locator('[data-tab-position]');
  const scenePhoto = page.locator('.work-panel:not([hidden]) .work-screen img');
  const sceneLayout = () => page.locator('.work-panels').evaluate(panels => {
    const screen = panels.querySelector('.work-panel:not([hidden]) .work-screen');
    return {
      height: panels.offsetHeight,
      screenTop: screen.getBoundingClientRect().top - panels.getBoundingClientRect().top,
    };
  });
  const sceneAnimation = () => scenePhoto.evaluate(node => getComputedStyle(node).animationName);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1050 });
    await go('/');
    assert.equal(await page.locator('.home-hero img[src*="/media/manuals/"]').count(), 3, '首页首屏轮播包含三张产品截图');
    assert.equal(await page.locator('.hero-gallery .brand-mark').count(), 0, '展示框不重复叠加Logo');
    if (width > 740) {
      assert(await page.locator('.home-top').evaluate(section => {
        const boundary = section.getBoundingClientRect().bottom - Number.parseFloat(getComputedStyle(section, '::before').bottom);
        const sides = [...section.querySelectorAll('[data-hero-position]:not([data-hero-position=front])')];
        return sides.length === 2 && sides.every(side =>
          getComputedStyle(side).opacity === '1' && side.getBoundingClientRect().bottom <= boundary);
      }), width + 'px宽度下侧图外框不透底且位于深色区');
    }
    const distances = await page.locator('.hero-gallery-deck').evaluate(stage => {
      const top = stage.getBoundingClientRect().top;
      const scrollStart = window.scrollY;
      window.scrollBy(0, 280);
      return {
        page: window.scrollY - scrollStart,
        stage: top - stage.getBoundingClientRect().top,
      };
    });
    assert.equal(distances.page, 280, width + 'px宽度下立即完成普通滚动');
    assert(Math.abs(distances.stage - distances.page) < 1, '首屏截图随页面移动');
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0, '普通滚动没有动画');
    const initialLayout = await sceneLayout();
    await nextScene.click();
    assert(await page.locator('#example-files').isVisible(), '切换后立即显示所选场景');
    assert.equal(await scenePosition.textContent(), '2 / 3');
    assert.equal(await page.locator('#example-files').getAttribute('data-slide-from'), 'right');
    assert.equal(await sceneAnimation(), 'work-image-enter');
    assert.deepEqual(await sceneLayout(), initialLayout, '切换时截图外框和场景区域的位置稳定');
    await previousScene.click();
    assert(await page.locator('#example-report').isVisible());
    assert.equal(await page.locator('#example-report').getAttribute('data-slide-from'), 'left');
    assert.equal(await sceneAnimation(), 'work-image-enter');
    assert.equal(await page.locator('.continuity-output:visible').count(), 3, '三个对账结果直接可见');
  }
  await previousScene.click();
  assert(await page.locator('#example-panels').isVisible(), '从首项向左切换可回到末项');
  assert.equal(await scenePosition.textContent(), '3 / 3');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await nextScene.click();
  assert(await page.locator('#example-report').isVisible());
  assert.equal(await sceneAnimation(), 'none', '减少动态效果时直接换图');
  checks.push('桌面、窄窗口和手机首页的自然滚动、截图左右切换、布局稳定及减少动态效果');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(0, 0);
  await go('/');
  const hero = page.locator('.hero-gallery');
  const heroDeck = hero.locator('.hero-gallery-deck');
  const front = hero.locator('[data-hero-position=front]');
  const selectedHero = hero.locator('[data-hero-select][aria-pressed=true]');
  const start = await heroDeck.boundingBox();
  assert.equal((await selectedHero.textContent()).trim(), '员工工作台');
  await front.getByRole('button', { name: '放大员工工作台的文件管理页面' }).waitFor({ timeout: 9000 });
  assert.equal((await selectedHero.textContent()).trim(), '文件管理');
  assert.deepEqual(await heroDeck.boundingBox(), start, '首屏自动轮播时外框位置和大小一致');
  assert(await hero.locator('[data-hero-position]').evaluateAll(slides => slides.every(slide => {
    const transform = new DOMMatrix(getComputedStyle(slide).transform);
    return Math.abs(transform.b) + Math.abs(transform.c) < .001;
  })), '三张截图均水平摆放');
  await front.getByRole('button', { name: '放大员工工作台的文件管理页面' }).click();
  assert(await page.locator('#image-lightbox').isVisible());
  assert.match(await page.locator('#lightbox-image').getAttribute('src'), /07-files\.png$/);
  await page.keyboard.press('Escape');
  assert(await hero.getByRole('button', { name: '播放轮播' }).isVisible(), '查看截图时暂停自动轮播');
  await hero.getByRole('button', { name: '业务面板', exact: true }).click();
  assert.equal((await selectedHero.textContent()).trim(), '业务面板');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await go('/');
  assert(await hero.getByRole('button', { name: '播放轮播' }).isVisible());
  assert.equal((await selectedHero.textContent()).trim(), '员工工作台', '减少动态效果时默认停在首图');
  checks.push('首屏截图水平排列、在视野内自动切换、放大当前图及减少动态效果');

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
