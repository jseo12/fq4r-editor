import { validateSave, parseSave, characterLevel99PowerRange, characterPower, characterName, editTroop, spellName, applyTroopMacro } from '../../packages/save-core/src/index.ts';
import { test, expect, chromium, _electron as electron } from '@playwright/test';
import { join, resolve } from 'node:path';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

function save(flags = 0x58) {
  const bytes = Buffer.alloc(0x8000); bytes.write('win4');
  bytes.fill(1, 0x696, 0x6de);
  bytes.set([16, 1], 0x492); bytes.set([3, 2], 0x498); bytes.set([2, 3], 0x4a0);
  bytes.writeUInt32LE(200, 0x692);
  bytes.writeUInt32LE(10, 0x200); bytes.writeUInt16LE(1, 0x204); bytes.writeUInt16LE(flags, 0x20c);
  bytes.set([0, 2, 6, 7, 1, 1, 15, 0xff], 0x6de); bytes[0x59a6] = 0xff;
  bytes.writeUInt16LE(0x1a, 0x9a6 + 220 * 32 + 2);
  bytes[0x9a6 + 220 * 32 + 0x17] = 0x06;
  bytes.writeUInt16LE(0x209, 0x9a6 + 221 * 32 + 2);
  bytes.writeUInt16LE(0x1234, 0x9a6 + 221 * 32 + 14);
  bytes[0x9a6 + 529 * 32 + 22] = 1;
  bytes.writeUInt16LE(1, 0x9a6 + 639 * 32 + 2);
  bytes[0x59a6] = 0x31; bytes[0x59a7] = 3; bytes[0x59ac] = 7;
  bytes.writeUInt16LE(1, 0x59a8);
  [220, 221, 639].forEach((slot, i) => bytes.writeUInt16LE(slot * 32, 0x59b6 + i * 2));
  let troopOffset = 0x59bc;
  for (const id of [252, 253, 254]) {
    bytes[troopOffset] = 0; bytes[troopOffset + 1] = 1; bytes[troopOffset + 6] = id;
    bytes.writeUInt16LE(1, troopOffset + 2);
    bytes.writeUInt16LE(0, troopOffset + 16);
    troopOffset += 18;
  }
  bytes[troopOffset] = 0xff;
  for (let i = 0; i < bytes.length; i++) if (i < 0x7da6 || i >= 0x7dae) bytes[0x7da6 + (i >>> 12)] ^= bytes[i];
  return bytes;
}

test('web: local file validation, read view, and mobile layout', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    await expect(page.getByRole('heading', { name: 'FQ4R Save Editor' })).toBeVisible();
    await expect(page.locator('.file-emblem')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '게임 폴더 선택', exact: true })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/landing-web.png', fullPage: true });
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'arbitrary.bin', mimeType: 'application/octet-stream', buffer: save() });
    await expect(page.getByRole('region', { name: '세이브 에디터' })).toBeVisible();
    await expect(page.locator('.loading-header, .loading-footer')).toHaveCount(0);
    const editorBounds = await page.locator('.editor').boundingBox();
    expect(editorBounds).toEqual({ x: 0, y: 0, width: 1280, height: 900 });
    expect(await page.evaluate(() => {
      const root = document.scrollingElement!;
      return root.scrollHeight <= root.clientHeight && root.scrollWidth <= root.clientWidth;
    })).toBe(true);
    await expect(page.getByText('카리온성', { exact: true })).toBeVisible();
    await expect(page.locator('.first-loading-zone')).toHaveCount(0);
    await expect(page.locator('.save-counts')).toContainText('캐릭터 531명');
    await expect(page.getByLabel('플레이 시간', { exact: true })).toHaveValue('10');
    await expect(page.getByLabel('난이도', { exact: true })).toHaveValue('고투');
    await expect(page.locator('.checksum-table tbody > tr')).toHaveCount(8);
    await expect(page.locator('.checksum-table tbody > tr.valid')).toHaveCount(8);
    await expect(page.locator('.verified, .checksum-summary, .checksum-hint')).toHaveCount(0);
    await expect(page.locator('.checksum-table th')).toHaveText(['영역', '저장된 체크섬', '체크섬 검사']);
    await expect(page.locator('.checksum-table tbody > tr').first().locator('td').first()).toHaveText('영역 0 - 0000~0FFF');
    const originalChecksumReport = await page.locator('.checksum-table tbody').innerText();
    await expect(page.getByLabel('골드', { exact: true })).toHaveValue('2000');
    await expect(page.getByLabel('골드', { exact: true })).toHaveAttribute('step', '10');
    await expect(page.locator('#gold-hint')).toContainText('게임 표시 금액, 10G 단위');
    for (const [label, modified] of [['플레이 시간', '20'], ['난이도', '보통'], ['골드', '100']] as const) {
      const control = page.getByLabel(label, { exact: true });
      const original = await control.inputValue();
      if (label === '난이도') await control.selectOption(modified); else await control.fill(modified);
      await expect(control).toHaveCSS('color', 'rgb(247, 247, 0)');
      await expect(control).toHaveCSS('border-top-color', 'rgb(247, 247, 0)');
      if (label === '난이도') await control.selectOption(original); else await control.fill(original);
      await expect(control).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(control).toHaveCSS('border-top-color', 'rgb(114, 229, 235)');
    }
    await page.getByRole('button', { name: '골드 MAX', exact: true }).click();
    await expect(page.getByLabel('골드', { exact: true })).toHaveValue('9999990');
    await expect(page.getByLabel('골드', { exact: true })).toHaveCSS('color', 'rgb(247, 247, 0)');
    for (const random of [0, 0.5, 0.999999]) {
      await page.evaluate(value => { Math.random = () => value; }, random);
      await page.getByRole('button', { name: '골드 랜덤', exact: true }).click();
      await expect(page.getByLabel('골드', { exact: true })).toHaveValue(String(Math.floor(random * 1000000) * 10));
    }
    await page.getByLabel('골드', { exact: true }).fill('9999990');
    await expect(page.getByLabel('골드', { exact: true })).toHaveValue('9999990');
    await page.getByLabel('골드', { exact: true }).fill('10000000');
    await expect(page.getByLabel('골드', { exact: true })).toHaveValue('9999990');
    await page.getByLabel('골드', { exact: true }).fill('123');
    await expect(page.getByLabel('골드', { exact: true })).toHaveValue('123');
    await page.getByLabel('골드', { exact: true }).blur();
    await expect(page.getByLabel('골드', { exact: true })).toHaveValue('120');
    await page.getByLabel('골드', { exact: true }).fill('10');
    await expect(page.locator('.checksum-table tbody > tr.valid')).toHaveCount(8);
    expect(await page.locator('.checksum-table tbody').innerText()).toBe(originalChecksumReport);
    await page.getByLabel('플레이 시간', { exact: true }).fill('4294967295');
    await expect(page.getByLabel('플레이 시간', { exact: true })).toHaveValue('4294967295');
    await page.getByLabel('플레이 시간', { exact: true }).fill('4294967296');
    await expect(page.getByLabel('플레이 시간', { exact: true })).toHaveValue('4294967295');
    await page.getByLabel('플레이 시간', { exact: true }).fill('-1');
    await expect(page.getByLabel('플레이 시간', { exact: true })).toHaveValue('4294967295');
    await page.getByLabel('플레이 시간', { exact: true }).fill('30');
    await page.getByLabel('난이도', { exact: true }).selectOption('초보');
    await expect(page.getByLabel('난이도', { exact: true })).toHaveValue('초보');
    expect(await page.locator('.checksum-table tbody').innerText()).toBe(originalChecksumReport);
    await page.screenshot({ path: 'test-results/editor-overview.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 600 });
    await expect(page.getByRole('button', { name: '마법', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const headerBefore = await page.locator('.editor-header').boundingBox();
    const overviewScroll = await page.locator('.editor-body').evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop > 0;
    });
    expect(overviewScroll).toBe(true);
    expect(await page.locator('.tab-panel').evaluate(element => getComputedStyle(element).overflow)).toBe('visible');
    expect((await page.locator('.editor-header').boundingBox())?.y).toBe(headerBefore?.y);
    await page.screenshot({ path: 'test-results/editor-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: '아이템', exact: true }).click();
    const itemRows = page.locator('.inventory-table tbody tr');
    await expect(itemRows).toHaveCount(3);
    await expect(itemRows.first().locator('.item-slot-number')).toHaveText('1');
    await expect(page.locator('.inventory-table th')).toHaveText(['NO', 'NAME', 'DESC', 'QTY', 'MACRO']);
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('엑스칼리버');
    await expect(itemRows.first().locator('.inventory-desc')).toContainText('AT+20 AR+10 DF+00 DR+05');
    await expect(itemRows.first().locator('.inventory-desc')).toContainText('쉽게 지치지 않도록 함');
    await page.setViewportSize({ width: 1279, height: 900 });
    await expect(page.locator('.inventory-table th:visible')).toHaveText(['NO', 'NAME', 'QTY', 'MACRO']);
    await expect(itemRows.first().locator('.inventory-desc')).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(itemRows.first().locator('.inventory-desc')).toBeVisible();

    await page.getByRole('button', { name: '슬롯 1 감정 상태', exact: true }).click();
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('？엑스칼리버');
    await expect(itemRows.first().locator('td').nth(1)).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(itemRows.first().locator('.item-slot-number')).toHaveText('1*');
    await expect(itemRows.first().locator('td').first()).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: '슬롯 1 감정 상태', exact: true })).toHaveText('미감정');
    await expect(page.getByRole('button', { name: '슬롯 1 감정 상태', exact: true })).toHaveCSS('color', 'rgba(255, 255, 255, 0.5)');
    await page.getByRole('button', { name: '전체감정', exact: true }).click();
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('엑스칼리버');
    await expect(page.getByRole('button', { name: '슬롯 1 감정 상태', exact: true })).toHaveText('감정');
    await expect(itemRows.first().locator('.item-slot-number')).toHaveText('1');
    await expect(itemRows.first().locator('td').first()).not.toHaveClass(/item-slot-changed/);
    await expect(itemRows.first().locator('td').nth(1)).toHaveCSS('color', 'rgb(255, 255, 255)');

    await page.getByLabel('슬롯 1 수량', { exact: true }).fill('99');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('99');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(itemRows.first().locator('.item-slot-number')).toHaveText('1*');
    await page.getByLabel('슬롯 1 수량', { exact: true }).fill('100');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('99');
    await page.getByRole('button', { name: '슬롯 1 드래그하여 교환', exact: true }).dragTo(itemRows.nth(1));
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('아이스소드');
    await expect(itemRows.nth(1).locator('td').nth(1)).toHaveText('엑스칼리버');
    await expect(page.getByLabel('슬롯 4 수량', { exact: true })).toHaveValue('99');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('2');
    await page.getByRole('button', { name: '개요', exact: true }).click();
    expect(await page.locator('.checksum-table tbody').innerText()).toBe(originalChecksumReport);
    await page.getByRole('button', { name: '아이템', exact: true }).click();
    await expect(itemRows.nth(1).locator('td').nth(1)).toHaveText('엑스칼리버');
    const dragData = await page.evaluateHandle(() => new DataTransfer());
    await page.getByRole('button', { name: '슬롯 8 드래그하여 교환', exact: true }).dispatchEvent('dragstart', { dataTransfer: dragData });
    await itemRows.nth(1).dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(itemRows.nth(1).locator('td').nth(1)).toHaveText('롱소드');
    await expect(itemRows.nth(2).locator('td').nth(1)).toHaveText('엑스칼리버');
    await itemRows.first().dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('롱소드');
    await expect(itemRows.nth(1).locator('td').nth(1)).toHaveText('아이스소드');
    await itemRows.first().dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('롱소드');
    await itemRows.first().dispatchEvent('drop', { dataTransfer: dragData });
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('롱소드');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('3');
    await expect(page.getByLabel('슬롯 8 수량', { exact: true })).toHaveValue('99');
    await dragData.dispose();
    await page.getByRole('button', { name: '슬롯 1 수량 99개', exact: true }).click();
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('99');
    for (const random of [0, 0.42, 0.999999]) {
      await page.evaluate(value => { Math.random = () => value; }, random);
      await page.getByRole('button', { name: '슬롯 1 랜덤수량', exact: true }).click();
      await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue(String(Math.floor(random * 100)));
    }
    await expect(page.getByRole('button', { name: '슬롯 1 아이템 삭제', exact: true })).toHaveCSS('background-color', 'rgb(146, 45, 60)');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '슬롯 1 아이템 삭제', exact: true }).click();
    await expect(itemRows).toHaveCount(3);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '슬롯 1 아이템 삭제', exact: true }).click();
    await expect(itemRows).toHaveCount(2);
    await expect(itemRows.locator('.item-slot-number')).toHaveText(['1*', '2*']);
    await expect(itemRows.locator('td:nth-child(2)')).toHaveText(['아이스소드', '엑스칼리버']);
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('슬롯 2 수량', { exact: true })).toHaveValue('99');
    await expect(page.getByLabel('슬롯 8 수량', { exact: true })).toHaveCount(0);
    await expect(page.locator('.item-count')).toHaveText('ITEM SLOT : 02/72');

    await page.getByRole('button', { name: '+ 아이템 슬롯 추가', exact: true }).click();
    await expect(page.getByRole('list', { name: '추가할 아이템' })).toBeVisible();
    await expect(page.getByRole('list', { name: '추가할 아이템' }).getByRole('button', { name: '엑스칼리버', exact: true })).toHaveCount(0);
    await expect(page.getByRole('list', { name: '추가할 아이템' }).getByRole('button', { name: '아이스소드', exact: true })).toHaveCount(0);
    await page.getByRole('list', { name: '추가할 아이템' }).getByRole('button', { name: '숏소드', exact: true }).click();
    await expect(page.getByRole('list', { name: '추가할 아이템' })).toHaveCount(0);
    await expect(itemRows).toHaveCount(3);
    await expect(itemRows.last().locator('td').nth(1)).toHaveText('숏소드');
    await expect(page.getByLabel('슬롯 3 수량', { exact: true })).toHaveValue('1');
    await expect(itemRows.locator('.item-slot-number')).toHaveText(['1*', '2*', '3*']);
    await page.getByRole('button', { name: '모든아이템획득', exact: true }).click();
    await expect(itemRows).toHaveCount(72);
    await expect(page.getByRole('button', { name: '+ 아이템 슬롯 추가', exact: true })).toHaveCount(0);
    await expect(page.getByText('-아이템 상한 도달-', { exact: true })).toBeVisible();
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('99');
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('숏소드');
    await expect(page.getByLabel('슬롯 4 수량', { exact: true })).toHaveValue('99');
    await expect(page.getByLabel('슬롯 10 수량', { exact: true })).toHaveValue('99');
    await page.getByRole('button', { name: '모든아이템획득', exact: true }).click();
    await expect(itemRows).toHaveCount(72);
    await expect(page.getByRole('button', { name: '+ 아이템 슬롯 추가', exact: true })).toHaveCount(0);
    await expect(page.getByText('-아이템 상한 도달-', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '전체99개', exact: true }).click();
    for (const input of await page.locator('.item-quantity').all()) await expect(input).toHaveValue('99');
    for (const random of [0, 0.999999]) {
      await page.evaluate(value => { Math.random = () => value; }, random);
      await page.getByRole('button', { name: '전체랜덤', exact: true }).click();
      for (const input of await page.locator('.item-quantity').all()) await expect(input).toHaveValue(random === 0 ? '1' : '99');
    }
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '전체리셋', exact: true }).click();
    await expect(page.getByLabel('슬롯 9 수량', { exact: true })).toHaveValue('99');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '전체리셋', exact: true }).click();
    await expect(itemRows).toHaveCount(3);
    await expect(page.getByLabel('슬롯 9 수량', { exact: true })).toHaveCount(0);
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('엑스칼리버');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('1');
    await expect(page.getByLabel('슬롯 4 수량', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('슬롯 8 수량', { exact: true })).toHaveValue('3');
    await expect(page.locator('.item-slot-changed, .item-quantity-changed')).toHaveCount(0);
    await expect(itemRows.first().locator('.item-slot-number')).toHaveText('1');
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveCSS('color', 'rgb(255, 255, 255)');

    await page.getByRole('button', { name: '오름차순 정렬', exact: true }).click();
    await expect(itemRows.locator('td:nth-child(2)')).toHaveText(['롱소드', '아이스소드', '엑스칼리버']);
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('3');
    await expect(page.getByLabel('슬롯 2 수량', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('슬롯 3 수량', { exact: true })).toHaveValue('1');
    await expect(itemRows.first().locator('.item-slot-number')).toHaveText('1*');
    await expect(page.locator('.item-count')).toHaveText('ITEM SLOT : 03/72');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '전체리셋', exact: true }).click();
    await expect(itemRows.first().locator('td').nth(1)).toHaveText('엑스칼리버');
    await expect(page.locator('.item-slot-changed, .item-quantity-changed')).toHaveCount(0);
    await page.getByRole('button', { name: 'AI추천정렬', exact: true }).click();
    await expect(itemRows.locator('td:nth-child(2)')).toHaveText(['엑스칼리버', '아이스소드', '롱소드']);
    await expect(page.getByLabel('슬롯 1 수량', { exact: true })).toHaveValue('1');
    await expect(page.getByLabel('슬롯 2 수량', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('슬롯 3 수량', { exact: true })).toHaveValue('3');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '전체리셋', exact: true }).click();
    await expect(page.locator('.item-slot-changed, .item-quantity-changed')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/editor-inventory.png', fullPage: true });
    await page.getByRole('button', { name: '마법', exact: true }).click();
    await expect(page.locator('.magic-class').first().locator('span')).toHaveText('킹');
    await expect(page.locator('.magic-class img').first()).toHaveCSS('width', '32px');
    const spellSlots = page.locator('.magic-slots').first().locator('select');
    await expect(spellSlots).toHaveCount(5);
    await expect(spellSlots.first()).toHaveValue('6');
    await expect(spellSlots.first().locator('option')).toHaveCount(54);
    await spellSlots.first().selectOption('8');
    await expect(spellSlots.first()).toHaveValue('8');
    await expect(spellSlots.first()).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(spellSlots.first()).toHaveCSS('border-top-color', 'rgb(247, 247, 0)');
    await expect(page.locator('.magic-class').first().locator('span')).toHaveText('킹*');
    await expect(page.locator('.magic-class').first().locator('span')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(spellSlots.nth(1)).not.toHaveClass(/magic-spell-changed/);
    await page.getByRole('button', { name: '킹 마법 1 삭제', exact: true }).click();
    await expect(spellSlots.first()).toHaveValue('0');
    await expect(spellSlots.nth(1)).toHaveValue('7');
    await expect(page.getByRole('button', { name: '킹 마법 1 삭제', exact: true })).toBeDisabled();
    await spellSlots.nth(4).selectOption('37');
    const slotWidths = await page.locator('.magic-slots').first().locator('.magic-slot').evaluateAll(slots => slots.map(slot => slot.getBoundingClientRect().width));
    expect(Math.max(...slotWidths) - Math.min(...slotWidths)).toBeLessThan(1);
    await page.getByRole('button', { name: '개요', exact: true }).click();
    expect(await page.locator('.checksum-table tbody').innerText()).toBe(originalChecksumReport);
    await page.getByRole('button', { name: '마법', exact: true }).click();
    await expect(spellSlots.first()).toHaveValue('0');
    await expect(spellSlots.nth(4)).toHaveValue('37');
    const otherSpells = page.locator('.magic-slots').nth(1).locator('select');
    await otherSpells.first().selectOption('30');
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: '킹 마법 RESET', exact: true }).click();
    await expect(spellSlots.first()).toHaveValue('0');
    await expect(spellSlots.nth(4)).toHaveValue('37');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '킹 마법 RESET', exact: true }).click();
    await expect(spellSlots.first()).toHaveValue('6');
    await expect(spellSlots.nth(1)).toHaveValue('7');
    await expect(spellSlots.nth(4)).toHaveValue('0');
    await expect(page.locator('.magic-class').first().locator('span')).toHaveText('킹');
    await expect(page.locator('.magic-class').first().locator('span')).toHaveCSS('color', 'rgb(124, 247, 124)');
    await expect(spellSlots.first()).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(spellSlots.first()).toHaveCSS('border-top-color', 'rgb(114, 229, 235)');
    await expect(page.locator('.magic-class').nth(1).locator('span')).toHaveClass(/magic-class-changed/);
    await expect(otherSpells.first()).toHaveValue('30');
    const removeSpell = page.getByRole('button', { name: '킹 마법 1 삭제', exact: true });
    await expect(removeSpell).toHaveText('×');
    await expect(removeSpell).toHaveCSS('width', '34px');
    await expect(removeSpell).toHaveCSS('height', '34px');
    await removeSpell.click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '킹 마법 RESET', exact: true }).click();
    await expect(spellSlots.first()).toHaveValue('6');

    await page.screenshot({ path: 'test-results/editor-magic.png', fullPage: true });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await expect(page.getByRole('radio', { name: '네임드 부대 보기', exact: true })).toBeChecked();
    await expect(page.locator('.troop-table tbody tr')).toHaveCount(3);
    await page.getByRole('radio', { name: '아군 부대 보기', exact: true }).check();
    await expect(page.locator('.troop-table tbody tr')).toHaveCount(3);
    await page.getByRole('radio', { name: '전체 부대 보기', exact: true }).check();
    await expect(page.locator('.troop-table tbody tr')).toHaveCount(4);
    await page.getByRole('radio', { name: '네임드 부대 보기', exact: true }).check();
    await expect(page.locator('.troop-table th')).toHaveText(['NATION', 'NO', 'NAME', 'ALL', 'POWER', 'MAP-NAME', 'ROSTER']);
    for (const name of ['병사1', '병사2', '병사3']) await expect(page.locator('.troop-table').getByRole('cell', { name, exact: true })).toBeVisible();
    const selectedTroop = page.locator('.troop-table tbody tr').filter({ has: page.locator('td:nth-child(2)', { hasText: /^7$/ }) });
    const troopCells = selectedTroop.locator('td');
    await expect(troopCells.nth(0)).toHaveText('카리온 (비활성)');
    await expect(troopCells.nth(0)).toHaveAttribute('title', '소속 +00: 0x31 / 국가 그룹 +05: 0x00');
    await expect(page.locator('.troop-table tbody tr').first().locator('td').first()).toHaveText('카리온');
    await expect(troopCells.nth(1)).toHaveText('7');
    await expect(troopCells.nth(2)).toHaveText('아레스');
    await expect(troopCells.nth(3)).toHaveText('3');
    await expect(troopCells.nth(4)).toHaveText('576');
    await expect(troopCells.nth(5)).toHaveText('카리온성');
    await expect(selectedTroop.locator('.troop-roster img')).toHaveCount(3);
    await expect(selectedTroop.locator('.troop-roster img').last()).toHaveAttribute('alt', /아이오로스/);
    await expect(selectedTroop.locator('.troop-roster img').first()).toHaveCSS('width', '32px');
    await expect(selectedTroop.locator('.troop-roster img').first()).toHaveCSS('height', '32px');
    const roster = await selectedTroop.locator('.troop-roster img').evaluateAll(images => images.map(image => image.getBoundingClientRect().y));
    expect(new Set(roster).size).toBe(1);
    await page.screenshot({ path: 'test-results/editor-troops.png', fullPage: true });
    for (const width of [1280, 1279, 1024, 1023, 760, 759, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const expectedColumns = width >= 1280 ? ['NATION', 'NO', 'NAME', 'ALL', 'POWER', 'MAP-NAME', 'ROSTER']
        : width >= 1024 ? ['NATION', 'NO', 'NAME', 'ALL', 'MAP-NAME', 'ROSTER']
        : width >= 760 ? ['NO', 'NAME', 'ALL', 'MAP-NAME', 'ROSTER'] : ['NO', 'NAME', 'ALL', 'ROSTER'];
      await expect(page.locator('.troop-table th:visible')).toHaveText(expectedColumns);
      await expect(selectedTroop.locator('td:visible')).toHaveCount(expectedColumns.length);
      const bodySize = await page.locator('.editor-body').evaluate(e => ({ width: e.clientWidth, scrollWidth: e.scrollWidth }));
      expect(bodySize.scrollWidth).toBeLessThanOrEqual(bodySize.width);
    }
    await expect(selectedTroop.locator('.roster-more')).toBeVisible();
    await expect(selectedTroop.locator('.roster-more')).toHaveAttribute('title', /부대원/);
    expect(await selectedTroop.locator('.troop-roster img').count()).toBeLessThan(3);
    await page.screenshot({ path: 'test-results/editor-troops-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(selectedTroop.locator('.troop-roster img')).toHaveCount(3);
    await expect(selectedTroop.locator('.roster-more')).toHaveCount(0);

    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    const npcToggle = page.getByRole('combobox', { name: '캐릭터 표시 범위', exact: true });
    await expect(npcToggle).toHaveValue('named');
    await expect(page.locator('tbody tr')).toHaveCount(311);
    await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('220');
    await expect(page.getByRole('columnheader', { name: '이름 ID', exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: '직업 ID', exact: true })).toHaveCount(0);
    await npcToggle.selectOption('all');
    await expect(page.locator('tbody tr')).toHaveCount(531);
    await expect(page.locator('tbody tr').first().locator('td').first()).toHaveText('0');
    await npcToggle.selectOption('named');
    await expect(page.locator('tbody tr')).toHaveCount(311);
    const characterIndices = await page.locator('tbody tr td:first-child').allTextContents();
    expect(characterIndices).toContain('528');
    expect(characterIndices).toContain('529');
    expect(characterIndices).toContain('639');
    expect(characterIndices).not.toContain('530');
    await expect(page.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: /^529$/ }) }).locator('td').nth(2)).toHaveText('(이름없음)');
    const allColumns = ['ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'FT', 'EL+', 'ITEM', 'SKILL'];
    for (const width of [1600, 1599, 1440, 1439, 1280, 1279, 960, 959, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const wanted = width >= 1600 ? allColumns : width >= 1440 ? allColumns.filter(c => c !== 'SKILL')
        : width >= 1280 ? allColumns.filter(c => !['SKILL', 'EL+', 'FT'].includes(c))
        : width >= 960 ? ['ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'ITEM']
        : ['ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'LV', 'ITEM'];
      await expect(page.locator('.character-table th:visible')).toHaveText(wanted);
      const visibleCells = page.locator('.character-table tbody tr').first().locator('td:visible');
      expect(await visibleCells.evaluateAll(cells => cells.map(cell => cell.getAttribute('data-column')))).toEqual(wanted);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1600, height: 900 });
    const aresRow = page.locator('.character-table tbody tr').filter({ has: page.getByRole('cell', { name: '아레스', exact: true }) });
    await aresRow.click();
    const characterModal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await expect(characterModal).toBeVisible();
    await expect(characterModal.locator('.record-hex-byte')).toHaveCount(32);
    await expect(characterModal.locator('.character-dialog-header .class-image')).toHaveCount(0);
    await expect(characterModal.locator('.character-dialog-header h2')).toHaveText('ID 220');
    await expect(characterModal.locator('.character-hex-labels > span')).toHaveText(['00', '01', 'NAME', '04', '05', 'CS', 'LD', 'EL', 'ST', 'FT', 'EX', 'CL', 'ID', 'EV', 'EV', 'AA', 'AD', 'MD', 'SP', 'PJ', 'IT', '16', 'SK', 'LV', 'HR', 'HP', 'HP', 'AT', 'AR', 'DF', 'DR']);

    const classPicker = characterModal.getByRole('combobox', { name: 'CLASS', exact: true });
    await expect(classPicker.locator('img')).toHaveAttribute('src', /classes\/00\.png$/);
    await expect(classPicker).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(classPicker).toHaveCSS('border-top-color', 'rgb(114, 229, 235)');
    await classPicker.click();
    const classList = characterModal.getByRole('listbox', { name: 'CLASS 선택 목록', exact: true });
    await expect(classList.getByRole('option')).toHaveCount(256);
    await expect(classList.getByRole('option').nth(1).locator('img')).toHaveAttribute('src', /classes\/01\.png$/);
    await classList.getByRole('option').nth(1).click();
    await expect(classPicker.locator('img')).toHaveAttribute('src', /classes\/01\.png$/);
    await expect(classPicker).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(classPicker).toHaveCSS('border-top-color', 'rgb(247, 247, 0)');
    await expect(classList).toHaveCount(0);
    await classPicker.click();
    await classPicker.press('Escape');
    await expect(classList).toHaveCount(0);
    await expect(characterModal).toBeVisible();
    await classPicker.press('Home');
    await classPicker.press('Enter');
    await expect(classPicker.locator('img')).toHaveAttribute('src', /classes\/00\.png$/);
    await expect(classPicker).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(classPicker).toHaveCSS('border-top-color', 'rgb(114, 229, 235)');

    const bounds = await characterModal.boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - 800)).toBeLessThan(2);
    expect(bounds!.y).toBe(0);
    expect(bounds!.height).toBe(900);
    expect(bounds!.width).toBe(1000);
    await expect(characterModal.locator('.character-max-button')).toHaveCount(12);
    const basicFields = characterModal.getByRole('group', { name: '기본 능력치', exact: true });
    await expect(basicFields.locator('.character-field').nth(11).getByLabel('FT (피로도)', { exact: true })).toBeVisible();
    await expect(basicFields.locator('.character-field').last().getByRole('button', { name: '모두 MAX', exact: true })).toBeVisible();
    await expect(basicFields.getByRole('group', { name: '능력치 매크로', exact: true })).toContainText('모두 MAX');
    const aiBounds = (await characterModal.getByLabel('AI 파라미터(전투성향)', { exact: true }).boundingBox())!;
    const promotionBounds = (await characterModal.getByRole('combobox', { name: '전직 클래스', exact: true }).boundingBox())!;
    expect(promotionBounds.x).toBeGreaterThan(aiBounds.x);
    expect(Math.abs(promotionBounds.y - aiBounds.y)).toBeLessThan(2);
    await characterModal.getByLabel('FT (피로도)', { exact: true }).fill('50');
    await expect(aresRow.locator('[data-column="FT"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await characterModal.getByRole('button', { name: 'FT ZERO', exact: true }).click();
    await expect(characterModal.getByLabel('FT (피로도)', { exact: true })).toHaveValue('0');
    await expect(aresRow.locator('[data-column="FT"]')).not.toHaveClass(/character-cell-changed/);
    await expect(aresRow.locator('[data-column="FT"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(characterModal.locator('.record-hex-byte[data-offset="10"]')).toHaveText('00');
    for (const [label, limit] of [['LV', 99], ['HP', 999], ['HR', 16], ['LEAD', 16], ['AT', 99], ['AR', 99], ['DF', 99], ['DR', 99], ['AA', 30], ['AD', 30], ['MD', 30]] as const) {
      const input = characterModal.getByLabel(label, { exact: true });
      const original = await input.inputValue();
      await expect(input).toHaveAttribute('max', String(limit));
      await input.fill('0');
      await characterModal.getByRole('button', { name: `${label} MAX`, exact: true }).click();
      await expect(input).toHaveValue(String(limit));
      await input.fill(String(limit + 1));
      await expect(input).toHaveValue(String(limit));
      await expect(input).toHaveAttribute('aria-invalid', 'false');
      await input.fill(original);
      await expect(input).toHaveCSS('color', 'rgb(255, 255, 255)');
      await expect(input).toHaveCSS('border-top-color', 'rgb(114, 229, 235)');
    }
    await characterModal.getByLabel('HP', { exact: true }).fill('999');
    await expect(characterModal.getByRole('button', { name: '취소', exact: true })).toHaveCount(0);
    await expect(characterModal.getByRole('button', { name: '적용', exact: true })).toHaveCount(0);
    await expect(aresRow.locator('[data-column="HP"]')).toHaveText('999');
    await characterModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(aresRow.locator('[data-column="HP"]')).toHaveText('999');
    await aresRow.press('Enter');
    await expect(characterModal).toBeVisible();
    await characterModal.getByLabel('HP', { exact: true }).fill('999');
    await characterModal.getByLabel('AT', { exact: true }).fill('99');
    await expect(characterModal.getByRole('group', { name: '이벤트 · 기타 원시 데이터', exact: true })).toBeVisible();
    for (const [label, offset, size] of [['격파수 후보', 0, 2], ['이벤트 참조', 4, 2], ['미확인 바이트', 22, 1]] as const) {
      const input = characterModal.getByLabel(label, { exact: true });
      const original = await input.inputValue();
      const before = await characterModal.locator('.record-hex-byte').allTextContents();
      await input.fill(size === 2 ? '4660' : '171');
      const after = await characterModal.locator('.record-hex-byte').allTextContents();
      expect(after[offset]).toBe(size === 2 ? '34' : 'AB');
      await expect(aresRow.locator('[data-column="ID"]')).toHaveText('220*');
      if (size === 2) expect(after[offset + 1]).toBe('12');
      for (let i = 0; i < 32; i++) if (i < offset || i >= offset + size) expect(after[i]).toBe(before[i]);
      await input.fill(original);
    }
    const eventLocation = characterModal.getByRole('combobox', { name: '사망·포로·실종 위치', exact: true });
    await expect(eventLocation.locator('optgroup')).toHaveCount(2);
    await eventLocation.selectOption('1');
    await expect(eventLocation.locator('option:checked')).toHaveText('카리온성 (0x0001)');
    await expect(eventLocation).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(eventLocation).toHaveCSS('border-top-color', 'rgb(247, 247, 0)');
    await expect(characterModal.locator('.record-hex-byte[data-offset="14"]')).toHaveText('01');
    await expect(characterModal.locator('.record-hex-byte[data-offset="15"]')).toHaveText('00');
    await eventLocation.selectOption('256');
    await expect(eventLocation.locator('option:checked')).toHaveText('링커-촌장 (0x0100)');
    await expect(characterModal.locator('.record-hex-byte[data-offset="14"]')).toHaveText('00');
    await expect(characterModal.locator('.record-hex-byte[data-offset="15"]')).toHaveText('01');
    await eventLocation.selectOption('0');
    await expect(eventLocation).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(eventLocation).toHaveCSS('border-top-color', 'rgb(114, 229, 235)');
    await expect(characterModal.locator('.record-hex-byte[data-offset="28"]')).toHaveText('63');
    await expect(characterModal.locator('.record-hex-byte[data-offset="28"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(characterModal.getByLabel('AD', { exact: true })).toHaveValue('30');
    await expect(characterModal.getByLabel('MD', { exact: true })).toHaveValue('30');
    await characterModal.getByLabel('AD', { exact: true }).fill('31');
    await expect(characterModal.getByLabel('AD', { exact: true })).toHaveValue('30');
    await expect(characterModal.locator('input[aria-invalid="true"]')).toHaveCount(0);
    await characterModal.getByLabel('AD', { exact: true }).fill('25');
    await characterModal.getByLabel('MD', { exact: true }).fill('23');
    const elementFlags = characterModal.getByRole('group', { name: 'EL+', exact: true });
    await expect(elementFlags.getByRole('checkbox')).toHaveCount(4);
    const beforeElements = parseInt((await characterModal.locator('.record-hex-byte[data-offset="8"]').textContent())!, 16);
    await characterModal.getByRole('button', { name: '모든 속성 강화', exact: true }).click();
    for (const label of ['F 불', 'E 땅', 'A 바람', 'W 물']) await expect(elementFlags.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
    await expect(characterModal.locator('.record-hex-byte[data-offset="8"]')).toHaveText((beforeElements | 0xf0).toString(16).toUpperCase().padStart(2, '0'));
    await expect(elementFlags.getByRole('checkbox', { name: 'F 불', exact: true }).locator('..')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await characterModal.getByRole('button', { name: '모든 속성 해제', exact: true }).click();
    await expect(elementFlags.getByRole('checkbox', { name: 'F 불', exact: true }).locator('..')).not.toHaveClass(/character-flag-changed/);
    for (const label of ['F 불', 'E 땅', 'A 바람', 'W 물']) await expect(elementFlags.getByRole('checkbox', { name: label, exact: true })).not.toBeChecked();
    await expect(characterModal.locator('.record-hex-byte[data-offset="8"]')).toHaveText((beforeElements & 0x0f).toString(16).toUpperCase().padStart(2, '0'));
    await characterModal.getByRole('button', { name: '모든 속성 강화', exact: true }).click();
    for (const label of ['E 땅', 'A 바람', 'W 물']) await elementFlags.getByRole('checkbox', { name: label, exact: true }).uncheck();
    await elementFlags.getByRole('checkbox', { name: 'F 불', exact: true }).check();
    const statusFlags = characterModal.getByRole('group', { name: '상태 플래그 +09', exact: true });
    await expect(statusFlags.getByRole('checkbox')).toHaveCount(8);
    await expect(statusFlags.getByRole('checkbox', { name: '0x02 기마', exact: true })).toBeVisible();
    await expect(statusFlags.getByRole('checkbox', { name: '0x04 미확인', exact: true })).toBeVisible();
    await statusFlags.getByRole('checkbox', { name: '0x01 궁병', exact: true }).check();
    const identityFlags = characterModal.getByRole('group', { name: '식별 플래그 +0D', exact: true });
    await expect(characterModal.getByRole('combobox', { name: '전직 클래스', exact: true })).toBeVisible();
    await identityFlags.getByRole('checkbox', { name: '0x02 전직', exact: true }).check();
    const promotionPicker = characterModal.getByRole('combobox', { name: '전직 클래스', exact: true });
    await expect(promotionPicker).toBeVisible();
    await expect(characterModal.getByRole('group', { name: '상태 · 성장 · 행동', exact: true }).getByRole('combobox', { name: '전직 클래스', exact: true })).toBeVisible();
    await promotionPicker.click();
    const promotionMenu = characterModal.locator('.class-select-options');

    const menuBounds = await promotionMenu.boundingBox();
    const pickerBounds = await promotionPicker.boundingBox();
    if (await promotionMenu.evaluate(element => element.classList.contains('opens-above'))) expect(menuBounds!.y + menuBounds!.height).toBeLessThanOrEqual(pickerBounds!.y);
    else expect(menuBounds!.y).toBeGreaterThanOrEqual(pickerBounds!.y + pickerBounds!.height);
    expect(menuBounds!.y).toBeGreaterThanOrEqual(0);
    await characterModal.getByRole('listbox', { name: '전직 클래스 선택 목록', exact: true }).getByRole('option').nth(0x35).click();
    await expect(promotionPicker.locator('img')).toHaveAttribute('src', /classes\/35\.png$/);
    await identityFlags.getByRole('checkbox', { name: '0x02 전직', exact: true }).uncheck();
    await expect(promotionPicker).toBeVisible();
    await identityFlags.getByRole('checkbox', { name: '0x02 전직', exact: true }).check();
    await expect(promotionPicker.locator('img')).toHaveAttribute('src', /classes\/35\.png$/);

    await expect(identityFlags.getByRole('checkbox')).toHaveCount(8);
    for (const label of ['0x01 사망', '0x04 엔딩 집계', '0x10 아군', '0x20 방장', '0x40 수감 관련(추정)']) await expect(identityFlags.getByRole('checkbox', { name: label, exact: true })).toBeVisible();
    await identityFlags.getByRole('checkbox', { name: '0x80 포로', exact: true }).check();

    await characterModal.getByLabel('AI 파라미터(전투성향)', { exact: true }).fill('256');
    await expect(characterModal.getByLabel('AI 파라미터(전투성향)', { exact: true })).toHaveValue('255');
    await expect(characterModal.locator('input[aria-invalid="true"]')).toHaveCount(0);
    await characterModal.getByLabel('AI 파라미터(전투성향)', { exact: true }).fill('17');
    await expect(characterModal.getByRole('button', { name: '이전 캐릭터', exact: true })).toBeDisabled();
    await characterModal.getByRole('button', { name: '다음 캐릭터', exact: true }).click();
    const nextModal = page.getByRole('dialog', { name: 'ID 221', exact: true });
    await expect(nextModal).toBeVisible();
    const unknownLocation = nextModal.getByRole('combobox', { name: '사망·포로·실종 위치', exact: true });
    await expect(unknownLocation).toHaveValue('4660');
    await expect(unknownLocation.locator('option:checked')).toHaveText('미확인 지역 (0x1234)');
    await nextModal.getByLabel('AT', { exact: true }).fill('45');
    await expect(nextModal.locator('.record-hex-byte[data-offset="14"]')).toHaveText('34');
    await expect(nextModal.locator('.record-hex-byte[data-offset="15"]')).toHaveText('12');
    await nextModal.getByLabel('FT (피로도)', { exact: true }).fill('50');
    const beforeMacro = await nextModal.locator('.record-hex-byte').allTextContents();
    await nextModal.getByRole('button', { name: '모두 MAX', exact: true }).click();
    for (const [label, limit] of [['LV', 99], ['HP', 999], ['HR', 16], ['LEAD', 16], ['AT', 99], ['AR', 99], ['DF', 99], ['DR', 99], ['AA', 30], ['AD', 30], ['MD', 30], ['FT (피로도)', 0]] as const) await expect(nextModal.getByLabel(label, { exact: true })).toHaveValue(String(limit));
    const nextElements = nextModal.getByRole('group', { name: 'EL+', exact: true });
    for (const label of ['F 불', 'E 땅', 'A 바람', 'W 물']) await expect(nextElements.getByRole('checkbox', { name: label, exact: true })).toBeChecked();
    const afterMacro = await nextModal.locator('.record-hex-byte').allTextContents();
    const changedOffsets = new Set([7, 8, 10, 16, 17, 18, 24, 25, 26, 27, 28, 29, 30, 31]);
    for (let i = 0; i < 32; i++) if (!changedOffsets.has(i)) expect(afterMacro[i]).toBe(beforeMacro[i]);
    expect(afterMacro[17]).toBe('00');
    expect(afterMacro[18]).toBe('00');
    expect(parseInt(afterMacro[8], 16) & 15).toBe(parseInt(beforeMacro[8], 16) & 15);
    let previousRandom = afterMacro;
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.evaluate(value => { Math.random = () => value; }, [0, 0.5, 0.999999][attempt]);
      await nextModal.getByRole('button', { name: '모두 랜덤', exact: true }).click();
      for (const [label, limit] of [['LV', 99], ['HP', 999], ['HR', 16], ['LEAD', 16], ['AT', 99], ['AR', 99], ['DF', 99], ['DR', 99], ['AA', 30], ['AD', 30], ['MD', 30]] as const) {
        const value = Number(await nextModal.getByLabel(label, { exact: true }).inputValue());
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(limit);
      }
      await expect(nextModal.getByLabel('FT (피로도)', { exact: true })).toHaveValue('0');
      const randomBytes = await nextModal.locator('.record-hex-byte').allTextContents();
      expect(randomBytes).not.toEqual(previousRandom);
      for (let i = 0; i < 32; i++) if (!changedOffsets.has(i)) expect(randomBytes[i]).toBe(beforeMacro[i]);
      expect(parseInt(randomBytes[8], 16) & 15).toBe(parseInt(beforeMacro[8], 16) & 15);
      expect(Number(await nextModal.getByLabel('AD', { exact: true }).inputValue())).toBe(30 - parseInt(randomBytes[17], 16));
      expect(Number(await nextModal.getByLabel('MD', { exact: true }).inputValue())).toBe(30 - parseInt(randomBytes[18], 16));
      previousRandom = randomBytes;
    }
    const nextClass = nextModal.getByRole('combobox', { name: 'CLASS', exact: true });
    await nextClass.click();
    await nextModal.getByRole('listbox', { name: 'CLASS 선택 목록', exact: true }).getByRole('option').nth(0x54).click();
    await nextModal.getByLabel('LV', { exact: true }).fill('49');
    await nextModal.getByLabel('HP', { exact: true }).fill('100');
    await nextModal.getByLabel('DF', { exact: true }).fill('40');
    await nextModal.getByLabel('FT (피로도)', { exact: true }).fill('13');
    await page.evaluate(() => { Math.random = () => 0; });
    await nextModal.getByRole('button', { name: 'LV+1', exact: true }).click();
    await expect(nextModal.getByLabel('LV', { exact: true })).toHaveValue('50');
    await expect(nextModal.getByLabel('HP', { exact: true })).toHaveValue('104');
    await expect(nextModal.getByLabel('DF', { exact: true })).toHaveValue('41');
    await expect(nextModal.getByLabel('FT (피로도)', { exact: true })).toHaveValue('13');
    await expect(nextModal.getByRole('checkbox', { name: '0x02 전직', exact: true })).toBeChecked();
    await expect(nextModal.getByRole('combobox', { name: '전직 클래스', exact: true }).locator('img')).toHaveAttribute('src', /classes\/56\.png$/);
    await nextModal.getByRole('button', { name: 'LV-1', exact: true }).click();
    await expect(nextModal.getByLabel('LV', { exact: true })).toHaveValue('49');
    await expect(nextModal.getByLabel('HP', { exact: true })).toHaveValue('100');
    await expect(nextModal.getByLabel('DF', { exact: true })).toHaveValue('40');
    await expect(nextModal.getByRole('checkbox', { name: '0x02 전직', exact: true })).not.toBeChecked();
    await nextModal.getByLabel('LV', { exact: true }).fill('70');
    await expect(nextModal.getByRole('checkbox', { name: '0x02 전직', exact: true })).toBeChecked();
    await expect(nextModal.getByLabel('HP', { exact: true })).toHaveValue('100');
    await nextModal.getByLabel('LV', { exact: true }).fill('0');
    await expect(nextModal.getByRole('button', { name: 'LV-1', exact: true })).toBeDisabled();
    await expect(nextModal.getByRole('checkbox', { name: '0x02 전직', exact: true })).not.toBeChecked();
    await nextModal.getByLabel('LV', { exact: true }).fill('48');
    await nextModal.getByLabel('HP', { exact: true }).fill('100');
    await nextModal.getByRole('button', { name: 'LV 99', exact: true }).click();
    await expect(nextModal.getByLabel('LV', { exact: true })).toHaveValue('99');
    await expect(nextModal.getByLabel('HP', { exact: true })).toHaveValue('304');
    await expect(nextModal.getByLabel('FT (피로도)', { exact: true })).toHaveValue('13');
    await expect(nextModal.getByRole('checkbox', { name: '0x02 전직', exact: true })).toBeChecked();
    await expect(nextModal.getByRole('combobox', { name: '전직 클래스', exact: true }).locator('img')).toHaveAttribute('src', /classes\/56\.png$/);
    await expect(nextModal.getByRole('button', { name: 'LV 99', exact: true })).toBeDisabled();
    await expect(nextModal.getByRole('button', { name: 'LV+1', exact: true })).toBeDisabled();
    // Reopen the edited character so reset must use the loaded file, not the modal snapshot.
    // 편집한 캐릭터를 다시 열어 모달 진입값이 아닌 최초 파일값으로 복원되는지 확인합니다.
    await nextModal.getByRole('button', { name: '이전 캐릭터', exact: true }).click();
    await characterModal.getByRole('button', { name: '다음 캐릭터', exact: true }).click();
    const beforeReset = await nextModal.locator('.record-hex-byte').allTextContents();
    page.once('dialog', async dialog => { expect(dialog.message()).toContain('처음 불러왔을 때'); await dialog.dismiss(); });
    await nextModal.getByRole('button', { name: '캐릭터 RESET', exact: true }).click();
    expect(await nextModal.locator('.record-hex-byte').allTextContents()).toEqual(beforeReset);
    page.once('dialog', dialog => dialog.accept());
    await nextModal.getByRole('button', { name: '캐릭터 RESET', exact: true }).click();
    const originalCharacter = Array.from(save().subarray(0x9a6 + 221 * 32, 0x9a6 + 222 * 32), byte => byte.toString(16).toUpperCase().padStart(2, '0'));
    await expect(nextModal.locator('.record-hex-byte')).toHaveText(originalCharacter);
    await expect(nextModal.getByLabel('LV', { exact: true })).toHaveValue('0');
    await expect(nextModal.locator('.record-hex-byte.changed')).toHaveCount(0);
    await expect(page.locator('.character-table tbody tr').filter({ has: page.getByRole('cell', { name: '애레인', exact: true }) }).locator('[data-column="ID"]')).toHaveText('221');
    await expect(nextModal.locator('.character-field-changed, .character-flag-changed')).toHaveCount(0);
    await expect(page.locator('.character-table tbody tr').filter({ has: page.getByRole('cell', { name: '애레인', exact: true }) }).locator('.character-cell-changed')).toHaveCount(0);
    await expect(nextModal.getByRole('combobox', { name: '사망·포로·실종 위치', exact: true })).toHaveValue('4660');

    await nextModal.getByRole('button', { name: '이전 캐릭터', exact: true }).click();
    await expect(characterModal).toBeVisible();
    await expect(characterModal.getByLabel('AI 파라미터(전투성향)', { exact: true })).toHaveValue('17');
    await expect(characterModal.getByLabel('AT', { exact: true })).toHaveValue('99');
    await page.screenshot({ path: 'test-results/character-modal.png', fullPage: true });
    await expect(aresRow.locator('[data-column="AT"]')).toHaveText('99');
    await expect(aresRow.locator('[data-column="AT"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(aresRow.locator('[data-column="ID"]')).toHaveText('220*');
    await expect(aresRow.locator('[data-column="ID"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await characterModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(characterModal).toHaveCount(0);
    await expect(aresRow.locator('[data-column="HP"]')).toHaveText('999');
    await expect(aresRow.locator('[data-column="AT"]')).toHaveText('99');
    await expect(aresRow.locator('[data-column="AT"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(aresRow.locator('[data-column="ID"]')).toHaveText('220*');
    await expect(aresRow.locator('[data-column="ID"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await aresRow.click();
    await expect(characterModal.locator('.record-hex-byte[data-offset="28"]')).toHaveClass(/changed/);
    await expect(characterModal.getByLabel('AT', { exact: true })).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(characterModal.getByLabel('AT', { exact: true })).toHaveCSS('border-top-color', 'rgb(247, 247, 0)');
    await expect(characterModal.getByLabel('AI 파라미터(전투성향)', { exact: true })).toHaveValue('17');
    await expect(characterModal.getByLabel('AD', { exact: true })).toHaveValue('25');
    await expect(characterModal.getByLabel('MD', { exact: true })).toHaveValue('23');
    await expect(elementFlags.getByRole('checkbox', { name: 'F 불', exact: true })).toBeChecked();
    await expect(statusFlags.getByRole('checkbox', { name: '0x01 궁병', exact: true })).toBeChecked();
    await expect(identityFlags.getByRole('checkbox', { name: '0x80 포로', exact: true })).toBeChecked();

    await page.setViewportSize({ width: 390, height: 600 });
    await expect(characterModal).toBeVisible();
    const mobileModalBounds = (await characterModal.boundingBox())!;
    expect(mobileModalBounds.x).toBe(0);
    expect(mobileModalBounds.y).toBe(0);
    expect(mobileModalBounds.width).toBe(390);
    expect(mobileModalBounds.height).toBe(600);
    await characterModal.press('Escape');
    await expect(characterModal).toHaveCount(0);
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(page.getByRole('columnheader', { name: 'NAME', exact: true })).toBeVisible();
    await expect(page.locator('.character-table th')).toHaveText(['ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'FT', 'EL+', 'ITEM', 'SKILL']);
    for (const column of ['CLASS', 'HR', 'AR', 'DR', 'AA']) {
      await expect(page.getByRole('columnheader', { name: column, exact: true })).toHaveCSS('color', 'rgb(124, 247, 124)');
    }
    await expect(page.getByRole('columnheader', { name: 'LV', exact: true })).toHaveCSS('color', 'rgb(0, 247, 247)');
    await expect(page.getByRole('columnheader', { name: 'FT', exact: true })).toHaveCSS('color', 'rgb(174, 236, 238)');
    await expect(aresRow.locator('[data-column="EL+"]')).toHaveCSS('font-family', 'Consolas, "Courier New", monospace');
    await expect(page.getByRole('cell', { name: '아레스', exact: true })).toBeVisible();
    await expect(page.locator('.character-table tbody tr').filter({ has: page.getByRole('cell', { name: '아레스', exact: true }) }).locator('td').last()).toHaveText('썬더');
    const classImage = page.locator('.character-table tbody tr').filter({ has: page.getByRole('cell', { name: '아레스', exact: true }) }).locator('.character-class img');
    await expect(classImage).toHaveAttribute('src', /assets\/classes\/00\.png$/);
    await expect(classImage).toHaveAttribute('srcset', /00@1\.5x\.png 1\.5x, .*00@2x\.png 2x$/);
    await expect(classImage).toHaveCSS('width', '32px');
    await expect(classImage).toHaveCSS('height', '32px');
    await expect.poll(() => classImage.evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(page.getByRole('cell', { name: '애레인', exact: true })).toBeVisible();
    const tableHeaderBefore = await page.locator('.editor-header').boundingBox();
    const tableScroll = await page.locator('.editor-body').evaluate(element => {
      element.scrollTop = 1000;
      return element.scrollHeight > element.clientHeight && element.scrollTop > 0;
    });
    expect(tableScroll).toBe(true);
    expect((await page.locator('.editor-header').boundingBox())?.y).toBe(tableHeaderBefore?.y);
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0);
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(page.locator('.first-loading-zone')).toBeVisible();
    await expect(page.locator('.loading-header, .loading-footer')).toHaveCount(2);
    const bad = save(); bad[0x7fff] ^= 1;
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'bad.dat', mimeType: 'application/octet-stream', buffer: bad });
    await expect(page.getByRole('region', { name: '세이브 에디터' })).toBeVisible();
    await expect(page.locator('.editor-body > .notice')).toHaveCount(0);
    await expect(page.locator('.checksum-table tbody > tr.invalid')).toHaveCount(1);
    await expect(page.locator('.checksum-table tbody > tr.invalid')).toContainText('영역 7');
    const invalidChecksumReport = await page.locator('.checksum-table tbody').innerText();
    await page.getByLabel('골드', { exact: true }).fill('20');
    expect(await page.locator('.checksum-table tbody').innerText()).toBe(invalidChecksumReport);
    await page.getByRole('button', { name: '영역 7 체크섬 수정', exact: true }).click();
    await expect(page.locator('.checksum-table tbody > tr.invalid')).toHaveCount(0);
    await expect(page.locator('.checksum-table tbody > tr.valid')).toHaveCount(8);
    await expect(page.getByRole('button', { name: '영역 7 체크섬 수정', exact: true })).toHaveCount(0);
    const repairedReport = await page.locator('.checksum-table tbody').innerText();
    await page.getByLabel('골드', { exact: true }).fill('30');
    expect(await page.locator('.checksum-table tbody').innerText()).toBe(repairedReport);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('bad.dat');
    const exported = new Uint8Array(await readFile((await download.path())!));
    expect(validateSave(exported).every(checksum => checksum.valid)).toBe(true);
    expect(parseSave(exported).summary.gold).toBe(3);
    await expect(page.locator('.checksum-table tbody > tr.valid')).toHaveCount(8);

    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'small.dat', mimeType: 'application/octet-stream', buffer: Buffer.from('bad') });
    await expect(page.getByRole('alert')).toContainText('32,768');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  } finally { await browser.close(); }
});

test('web: modified-character filter enables on edits, combines with NPC visibility, and clears after resets', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'characters.dat', mimeType: 'application/octet-stream', buffer: save() });
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    const toggle = page.getByRole('checkbox', { name: '수정한 캐릭터만 표시', exact: true });
    const npc = page.getByRole('combobox', { name: '캐릭터 표시 범위', exact: true });
    const rows = page.locator('.character-table tbody tr');
    await expect(toggle).toBeDisabled(); await expect(toggle).not.toBeChecked();
    await expect(npc).toHaveValue('named');
    await expect(page.locator('label[for="show-modified-characters"] .character-filter-count')).toHaveText('(0명)');
    await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const ares = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await ares.getByLabel('AT', { exact: true }).fill('10');
    await ares.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(toggle).toBeEnabled();
    await expect(page.locator('label[for="show-modified-characters"] .character-filter-count')).toHaveText('(1명)');
    await toggle.check();
    await expect(rows).toHaveCount(1); await expect(rows.first().locator('td').first()).toHaveText('220*');
    await page.getByRole('button', { name: '개요', exact: true }).click();
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await expect(toggle).toBeChecked(); await expect(rows).toHaveCount(1);
    await toggle.uncheck(); await npc.selectOption('all');
    await rows.filter({ has: page.locator('td[data-column="ID"]', { hasText: /^0$/ }) }).click();
    const npcModal = page.getByRole('dialog', { name: 'ID 0', exact: true });
    await npcModal.getByLabel('AI 파라미터(전투성향)', { exact: true }).fill('5');
    await npcModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await toggle.check(); await expect(rows).toHaveCount(2);
    await expect(page.locator('label[for="show-modified-characters"] .character-filter-count')).toHaveText('(2명)');
    await npc.selectOption('named'); await expect(rows).toHaveCount(1);
    await rows.first().click();
    page.once('dialog', dialog => dialog.accept());
    await ares.getByRole('button', { name: '캐릭터 RESET', exact: true }).click();
    await ares.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(toggle).toBeEnabled(); await expect(rows).toHaveCount(0);
    await expect(page.getByText('표시할 캐릭터가 없습니다.', { exact: true })).toBeVisible();
    await npc.selectOption('all'); await expect(rows).toHaveCount(1);
    await rows.first().click();
    page.once('dialog', dialog => dialog.accept());
    await npcModal.getByRole('button', { name: '캐릭터 RESET', exact: true }).click();
    await npcModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(toggle).toBeDisabled(); await expect(toggle).not.toBeChecked();
    await expect(rows).toHaveCount(531);
  } finally { await browser.close(); }
});

test('web: troop modal separates information and read-only roster panels', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'troops.dat', mimeType: 'application/octet-stream', buffer: save() });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await expect(modal.getByRole('tab', { name: '부대 정보', exact: true })).toHaveAttribute('aria-selected', 'true');
    await modal.getByLabel('소속', { exact: true }).selectOption('0');
    await modal.getByLabel('활동 상태', { exact: true }).selectOption('0');
    await modal.getByLabel('부대 NO', { exact: true }).fill('9');
    await modal.getByLabel('MAP-NAME', { exact: true }).selectOption('256');
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await expect(modal.getByRole('tabpanel', { name: '부대 정보', exact: true })).toBeHidden();
    await expect(modal.getByRole('table', { name: '현재 부대원 목록', exact: true }).locator('tbody tr')).toHaveCount(3);
    await expect(modal.getByRole('button', { name: '부대원 추가', exact: true })).toHaveCount(0);
    await expect(modal.getByLabel('부대원 1 캐릭터', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/troop-modal.png', fullPage: true });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('row', { name: '부대 9 편집', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '부대 RESET', exact: true }).click();
    await expect(modal.getByLabel('소속', { exact: true })).toHaveValue('1');
    await expect(modal.getByLabel('활동 상태', { exact: true })).toHaveValue('3');
    await expect(modal.getByTestId('troop-member-count')).toHaveText('3명');
    await modal.press('Escape'); await expect(modal).toHaveCount(0);
  } finally { await browser.close(); }
});

test('web: full inventory hides addition and filters existing items after freeing a slot', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    const full = save();
    for (let slot = 0; slot < 256; slot++) full.set([1, 1], 0x492 + slot * 2);
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'full.dat', mimeType: 'application/octet-stream', buffer: full });
    await page.getByRole('button', { name: '아이템', exact: true }).click();
    await expect(page.getByRole('button', { name: '+ 아이템 슬롯 추가', exact: true })).toHaveCount(0);
    await expect(page.getByText('-아이템 상한 도달-', { exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '슬롯 1 아이템 삭제', exact: true }).click();
    await page.getByRole('button', { name: '+ 아이템 슬롯 추가', exact: true }).click();
    const picker = page.getByRole('list', { name: '추가할 아이템' });
    await expect(picker.getByRole('button', { name: '숏소드', exact: true })).toHaveCount(0);
    await picker.getByRole('button', { name: '롱소드', exact: true }).click();
    await expect(page.locator('.inventory-table tbody tr')).toHaveCount(256);
    await expect(page.getByText('-아이템 상한 도달-', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ 아이템 슬롯 추가', exact: true })).toHaveCount(0);
  } finally { await browser.close(); }
});

test('desktop UI: folder list, selection, and validation errors', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });
  const bytes = Array.from(save());
  await page.addInitScript(({ bytes }) => {
    const result = { kind: 'folder', folder: 'C:\\Games\\FQ4R', entries: [
      { id: 'slot-0', name: 'save00.dat', summary: { locationId: 1, location: '카리온성', playMinutes: 10, difficulty: '고투', gold: 0 } },
      { id: 'slot-1', name: 'save01.dat', summary: { locationId: 10, location: '켄트마을', playMinutes: 30, difficulty: '처음', gold: 0 } },
    ], errors: ['save02.dat: FQ4R 세이브 파일 형식이 아닙니다.'] } as const;
    let folderOpened = false;
    const bridge = {
      saveFile: async (_id: string, data: Uint8Array) => {
        if (data.length !== 32768) throw new Error('Invalid save');
        return { backupName: 'save01.bak' };
      },
      chooseFile: async () => { folderOpened = true; return result; },
      chooseFolder: async () => result,
      openDroppedFile: async () => result,
      restoreFolder: async () => folderOpened ? result : null,
      loadSave: async (id: string) => {
        if (id === 'slot-1') {
          const changed = new Uint8Array(bytes); changed[0x7fff] ^= 1;
          return { name: 'save01.dat', data: changed, saveId: id };
        }
        return { name: 'save00.dat', data: new Uint8Array(bytes), saveId: id };
      },
    };
    Object.defineProperty(window, 'fq4rDesktop', { value: bridge });
  }, { bytes });
  try {
    await page.goto('http://127.0.0.1:5174');
    await expect(page.getByRole('button', { name: '게임 폴더 선택', exact: true })).toHaveCount(0);
    await page.locator('.drop-zone').click();
    await expect(page.locator('.first-loading-zone')).toBeVisible();
    await expect(page.locator('.drop-zone')).toHaveCount(0);
    await expect(page.locator('.first-loading-zone select')).toHaveCount(0);
    const slots = page.locator('.save-file-list button');
    await expect(slots).toHaveCount(2);
    await expect(slots.nth(0)).toHaveText(/카리온성.*10분.*고투/);
    await expect(slots.nth(1)).toHaveText(/켄트마을.*30분.*처음/);
    await page.screenshot({ path: 'test-results/desktop-list.png', fullPage: true });
    await slots.nth(0).click();
    await expect(page.getByRole('region', { name: '세이브 에디터' })).toBeVisible();
    await expect(page.locator('.first-loading-zone')).toHaveCount(0);
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(slots).toHaveCount(2);
    await slots.nth(1).click();
    await expect(page.getByRole('region', { name: '세이브 에디터' })).toBeVisible();
    await expect(page.locator('.editor-body > .notice')).toHaveCount(0);
    await expect(page.locator('.checksum-table tbody > tr.invalid')).toHaveCount(1);
    await expect(page.getByRole('button', { name: '세이브 파일 다운로드', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('save01.bak');
    await expect(page.locator('.checksum-table tbody > tr.valid')).toHaveCount(8);
  } finally { await browser.close(); }
});

test('desktop-native: folder list, remembered folder on restart, and file validation', async () => {
  test.skip(process.env.FQ4R_NATIVE_E2E !== '1', 'Opt-in native Electron test; run npm run test:desktop.');
  const root = await mkdtemp(join(tmpdir(), 'fq4r-electron-'));
  const game = join(root, '게임'); await mkdir(game);
  await writeFile(join(game, 'save00.dat'), save());
  await writeFile(join(game, 'save01.dat'), save(0));
  await writeFile(join(game, 'save02.dat'), Buffer.from('bad'));
  const userData = join(root, 'settings'); await mkdir(userData);
  await writeFile(join(userData, 'settings.json'), JSON.stringify({ gameFolder: game }));
  const launch = () => electron.launch({ args: [resolve('apps/desktop')], timeout: 20_000, env: { ...process.env, FQ4R_TEST_USER_DATA: userData } });
  let app: Awaited<ReturnType<typeof launch>> | undefined;
  try {
    app = await launch();
    let page = await app.firstWindow();
    await expect(page.locator('.save-file-list')).toBeVisible();
    await expect(page.locator('.save-file-list button')).toHaveCount(2);
    await expect(page.locator('.save-file-list button').nth(0)).toHaveText(/카리온성.*10분.*고투/);
    await expect(page.getByText(/save02.dat:/)).toBeVisible();
    await page.locator('.save-file-list button').nth(0).click();
    await expect(page.getByRole('region', { name: '세이브 에디터' })).toBeVisible();
    const reload = page.getByRole('button', { name: '세이브 다시읽기', exact: true });
    await expect(reload).toHaveCount(0);
    const external = save(); external.writeUInt32LE(456, 0x200);
    await writeFile(join(game, 'save00.dat'), external);
    await expect(reload).toBeVisible({ timeout: 5000 });
    await reload.click();
    await expect(page.locator('input[type="number"]').first()).toHaveValue('456');
    await expect(reload).toHaveCount(0);
    await page.locator('input[type="number"]').first().fill('789');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    await page.waitForTimeout(1500);
    await expect(reload).toHaveCount(0);
    await page.screenshot({ path: 'test-results/desktop-save.png', fullPage: true });
    await app?.close();
    app = await launch(); page = await app.firstWindow();
    await expect(page.locator('.save-file-list')).toBeVisible();
    await expect(page.locator('.save-file-list button')).toHaveCount(2);
  } finally {
    await app?.close();
    expect(resolve(root).startsWith(resolve(tmpdir()) + (await import('node:path')).sep)).toBe(true);
    await rm(root, { recursive: true, force: true });
  }
});


test('web: troop detailed fields preserve nibbles, strength, unknown bytes and original reset', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1400, height: 1000 } });
  try {
    const bytes = save(); bytes[0x59a6 + 3] = 90; bytes[0x59a6 + 5] = 0x1d; bytes[0x59a6 + 14] = 0x62;
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'troop-details.dat', mimeType: 'application/octet-stream', buffer: bytes });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await expect(modal.getByLabel('활동 상태', { exact: true })).toHaveValue('3');
    await modal.getByLabel('소속', { exact: true }).selectOption('4');
    await modal.getByLabel('국가', { exact: true }).selectOption('5');
    await expect(modal.getByLabel('국가 표시 그룹', { exact: true })).toHaveValue('1');
    await modal.getByLabel('국가 표시 그룹', { exact: true }).selectOption('6');
    await modal.getByLabel('MAP-NAME', { exact: true }).selectOption('2');
    await expect(modal.getByLabel('전투 강화값', { exact: true })).toHaveValue('90');
    await modal.getByLabel('전투 강화값', { exact: true }).fill('60');
    await modal.getByLabel('이동 명령', { exact: true }).selectOption('254');
    await modal.getByText('추가 부대 정보', { exact: true }).click();
    await modal.getByLabel('이전·복귀 위치', { exact: true }).selectOption('256');
    await modal.getByLabel('진행 조건', { exact: true }).selectOption('7');
    await expect(modal.getByLabel('진행 조건 하위 니블', { exact: true })).toHaveValue('2');
    await modal.getByLabel('미확정 +08', { exact: true }).fill('AB');
    const changedBytes = modal.locator('.troop-hex-grid > .changed');
    await expect(changedBytes).toHaveCount(8);
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    await expect(changedBytes).toHaveCount(8);
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise;
    const exported = new Uint8Array(await readFile((await download.path())!));
    expect(Array.from(exported.slice(0x59a6, 0x59b6))).toEqual(Array.from(bytes.slice(0x59a6, 0x59b6)).map((value, offset) => ({ 0: 0x34, 2: 2, 3: 60, 5: 0x65, 8: 0xab, 10: 254, 12: 0, 13: 1, 14: 0x72 }[offset] ?? value)));
    validateSave(exported);
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '부대 RESET', exact: true }).click();
    await expect(changedBytes).toHaveCount(0);
    await expect(modal.getByLabel('전투 강화값', { exact: true })).toHaveValue('90');
    await page.screenshot({ path: 'test-results/troop-details.png', fullPage: true });
  } finally { await browser.close(); }
});


test('web: inactive troop filter defaults off and all troops enables it', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'inactive.dat', mimeType: 'application/octet-stream', buffer: save() });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    const toggle = page.getByRole('checkbox', { name: '비활성부대 보기', exact: true });
    const inactive = page.getByRole('row', { name: '부대 7 편집', exact: true });
    await expect(toggle).not.toBeChecked(); await expect(inactive).toHaveCount(0);
    await toggle.check(); await expect(inactive).toHaveCount(1);
    await toggle.uncheck(); await expect(inactive).toHaveCount(0);
    await page.getByRole('radio', { name: '전체 부대 보기', exact: true }).check();
    await expect(toggle).toBeChecked(); await expect(inactive).toHaveCount(1);
    await toggle.uncheck(); await expect(inactive).toHaveCount(0);
    await expect(page.locator('.troop-table tbody tr')).toHaveCount(3);
    await page.getByRole('radio', { name: '네임드 부대 보기', exact: true }).check();
    await expect(toggle).not.toBeChecked();
    await page.getByRole('radio', { name: '전체 부대 보기', exact: true }).check();
    await expect(toggle).toBeChecked();
  } finally { await browser.close(); }
});


test('web: allied troop macros clone, retain reset baselines, recruit and report limits', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1500, height: 1000 } });
  try {
    const bytes = save(); bytes[0x59a6 + 3] = 90; bytes[0x59a6 + 5] = 0x1d;
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'troop-macros.dat', mimeType: 'application/octet-stream', buffer: bytes });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('button', { name: '아군부대로 복제', exact: true }).click();
    await expect(modal.getByRole('status')).toHaveText('아군 부대 NO 1로 복제했습니다.');
    await expect(modal.getByLabel('활동 상태', { exact: true })).toHaveValue('3');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await expect(page.locator('.troop-table tbody tr')).toHaveCount(5);
    await page.getByRole('row', { name: '부대 1 편집', exact: true }).click();
    await expect(modal.getByLabel('국가', { exact: true })).toHaveValue('0');
    await expect(modal.getByLabel('국가 표시 그룹', { exact: true })).toHaveValue('0');
    await expect(modal.getByLabel('MAP-NAME', { exact: true })).toHaveValue('1');
    await modal.getByLabel('이동 명령', { exact: true }).selectOption('254');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '개요', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('row', { name: '부대 1 편집', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '부대 RESET', exact: true }).click();
    await expect(modal.getByLabel('이동 명령', { exact: true })).toHaveValue('0');
    await expect(modal.locator('.troop-hex-grid > .changed')).toHaveCount(0);
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    await modal.getByRole('button', { name: '강제 아군부대 편입', exact: true }).click();
    await expect(modal.getByLabel('소속', { exact: true })).toHaveValue('0');
    await expect(modal.getByLabel('활동 상태', { exact: true })).toHaveValue('0');
    await expect(modal.getByLabel('부대 NO', { exact: true })).toHaveValue('2');
    await modal.getByLabel('부대 NO', { exact: true }).fill('20');
    await modal.getByRole('button', { name: '아군부대로 복제', exact: true }).click();
    await expect(modal.getByRole('alert')).toContainText('아군 부대 상한');
    await page.screenshot({ path: 'test-results/troop-macro-limit.png', fullPage: true });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise;
    const exported = new Uint8Array(await readFile((await download.path())!));
    const troops = parseSave(exported).troops;
    expect(troops).toHaveLength(5); expect(troops[0]).toMatchObject({ state: 0, id: 19, mapId: 1, members: [220, 221, 639] });
    expect(troops[4]).toMatchObject({ state: 0, id: 0, mapId: 1, members: [220, 221, 639] });
    expect(exported.slice(0x9a6, 0x59a6)).toEqual(new Uint8Array(bytes.slice(0x9a6, 0x59a6)));
    validateSave(exported);
  } finally { await browser.close(); }
});


test('web: forced troop deletion confirms risk and keeps shifted reset baselines aligned', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1500, height: 1000 } });
  try {
    const bytes = save();
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'delete-troops.dat', mimeType: 'application/octet-stream', buffer: bytes });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('button', { name: '아군부대로 복제', exact: true }).click();
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('confirm'); expect(dialog.message()).toContain('버그나 충돌'); await dialog.dismiss();
    });
    await modal.getByRole('button', { name: '이 부대 강제 삭제', exact: true }).click();
    await expect(modal).toBeVisible(); await expect(page.locator('.troop-table tbody tr')).toHaveCount(5);
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '이 부대 강제 삭제', exact: true }).click();
    await expect(modal).toHaveCount(0); await expect(page.locator('.troop-table tbody tr')).toHaveCount(4);
    await expect(page.getByRole('row', { name: '부대 7 편집', exact: true })).toHaveCount(0);
    await page.getByRole('row', { name: '부대 253 편집', exact: true }).click();
    await modal.getByLabel('국가', { exact: true }).selectOption('5');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '개요', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('row', { name: '부대 253 편집', exact: true }).click();
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '부대 RESET', exact: true }).click();
    await expect(modal.getByLabel('부대 NO', { exact: true })).toHaveValue('253');
    await expect(modal.getByLabel('국가', { exact: true })).toHaveValue('0');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('row', { name: '부대 1 편집', exact: true }).click();
    await modal.getByLabel('부대 NO', { exact: true }).fill('2');
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '부대 RESET', exact: true }).click();
    await expect(modal.getByLabel('부대 NO', { exact: true })).toHaveValue('1');
    await expect(modal.getByRole('button', { name: '이 부대 강제 삭제', exact: true })).toBeDisabled();
    await expect(modal.getByRole('button', { name: '강제 아군부대 편입', exact: true })).toBeDisabled();
    await modal.getByLabel('부대 NO', { exact: true }).fill('2');
    await expect(modal.getByRole('button', { name: '이 부대 강제 삭제', exact: true })).toBeEnabled();
    page.once('dialog', dialog => dialog.accept());
    await modal.getByRole('button', { name: '이 부대 강제 삭제', exact: true }).click();
    await expect(modal).toHaveCount(0); await expect(page.locator('.troop-table tbody tr')).toHaveCount(3);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise;
    const exported = new Uint8Array(await readFile((await download.path())!));
    expect(parseSave(exported).troops.map(troop => troop.id)).toEqual([252, 253, 254]);
    expect(exported.slice(0x9a6, 0x59a6)).toEqual(new Uint8Array(bytes.slice(0x9a6, 0x59a6)));
    validateSave(exported);
  } finally { await browser.close(); }
});


test('web: dual troop roster uses container-responsive columns and selection preserves save bytes', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1400, height: 1000 } });
  try {
    const bytes = save(); const offset = 0x9a6 + 220 * 32;
    bytes[offset + 7] = 10; bytes[offset + 24] = 55; bytes.writeUInt16LE(999, offset + 26);
    bytes[offset + 17] = 5; bytes[offset + 18] = 6; bytes[offset + 21] = 0x2d;
    const source = parseSave(new Uint8Array(bytes)); const power = characterPower(source.characters.find(character => character.index === 220)!);
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'rosters.dat', mimeType: 'application/octet-stream', buffer: bytes });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true });
    const picker = modal.getByRole('table', { name: '제2부대 선택 목록', exact: true });
    await expect(picker.locator('tbody tr')).toHaveCount(4);
    await expect(current.locator('tbody tr')).toHaveCount(3);
    const first = current.locator('tbody tr').first();
    const currentScroll = current.locator('..');
    const scrollBounds = (await currentScroll.boundingBox())!;
    const modalBounds = (await modal.boundingBox())!;
    expect(modalBounds.y + modalBounds.height - (scrollBounds.y + scrollBounds.height)).toBeLessThanOrEqual(32);
    expect(await currentScroll.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    const body = modal.locator('.character-dialog-body');
    expect(await body.evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

    await expect(current.locator('tbody [data-column="NO"]')).toHaveText(['1', '2', '3']);
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['220', '221', '639']);
    await expect(first.locator('[data-column="SKILL"]')).toHaveText(spellName(6));
    await expect(first.locator('[data-column="LEAD"]')).toHaveText('⭐10');
    await expect(first.locator('[data-column="NAME"]')).toHaveText('아레스');
    await expect(first.locator('[data-column="NAME"] img')).toHaveAttribute('width', '32');
    await expect(first.locator('[data-column="POWER"]')).toHaveText(String(power));
    await expect(first.locator('[data-column="HR"]')).toHaveText('16');
    await expect(first.locator('[data-column="AD"]')).toHaveText('25');
    await expect(first.locator('[data-column="MD"]')).toHaveText('24');
    const full = ['NO', 'ID', 'LEAD', 'NAME', 'POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'ITEM', 'SKILL'];
    for (const width of [800, 1400, 1800, 2200]) {
      await page.setViewportSize({ width, height: 1000 });
      const rosterWidth = await current.locator('..').locator('..').evaluate(element => element.clientWidth);
      const pickerWidth = await picker.locator('..').locator('..').evaluate(element => element.clientWidth);
      const expected = full.filter(column => !(column === 'ITEM' && rosterWidth < 400) && !(column === 'POWER' && rosterWidth < 320) && !(column === 'LEAD' && rosterWidth < 240) && !(['LV', 'HP', 'HR'].includes(column) && rosterWidth < 560) && !(['AT', 'AR', 'DF', 'DR'].includes(column) && rosterWidth < 760) && !(['ID', 'AD', 'AA', 'MD', 'SKILL'].includes(column) && rosterWidth < 960));
      await expect(current.locator('thead th:visible')).toHaveText(expected);
      const expectedPicker = ['NATION', 'NO', 'NAME', 'ALL', 'POWER', 'MAP-NAME', 'ROSTER'].filter(column => !(column === 'ALL' && pickerWidth < 360) && !(column === 'NATION' && pickerWidth < 520) && !(column === 'POWER' && pickerWidth < 400) && !(column === 'MAP-NAME' && pickerWidth < 840) && !(column === 'ROSTER' && pickerWidth < 680));
      await expect(picker.locator('thead th:visible')).toHaveText(expectedPicker);
      if (rosterWidth >= 560) expect((await first.locator('[data-column="NAME"]').boundingBox())!.width).toBeLessThanOrEqual(161);
      if (pickerWidth >= 680) expect((await picker.locator('tbody tr').first().locator('[data-column="NAME"]').boundingBox())!.width).toBeLessThanOrEqual(161);
      if (pickerWidth >= 360 && pickerWidth < 680) expect((await picker.locator('tbody tr').first().locator('[data-column="ALL"]').boundingBox())!.width).toBeLessThanOrEqual(49);
    }
    await page.screenshot({ path: 'test-results/troop-rosters-wide.png', fullPage: true });
    await picker.getByRole('row', { name: /제2부대 NO 253/ }).click();
    const second = modal.getByRole('table', { name: '제2부대원 목록', exact: true });
    await expect(second.locator('tbody tr')).toHaveCount(1);
    await expect(second.locator('tbody [data-column="NAME"]')).toHaveText('(이름없음)');
    await expect(second.locator('tbody [data-column="ITEM"]')).toHaveText('없음');
    await expect(second.locator('tbody [data-column="NAME"]')).toHaveCSS('color', 'rgba(255, 255, 255, 0.6)');
    await modal.getByRole('button', { name: '부대 목록', exact: true }).click();
    await expect(picker).toBeVisible();
    await picker.getByRole('row', { name: /제2부대 NO 7 / }).press('Enter');
    await expect(second.locator('tbody tr')).toHaveCount(3);
    await expect(second.locator('thead th:visible')).toHaveText(await current.locator('thead th:visible').allTextContents());
    for (const width of [640, 840, 1100]) {
      await page.setViewportSize({ width, height: 1000 });
      const areaWidth = await second.locator('..').locator('..').evaluate(element => element.clientWidth);
      const columns = ['NO', ...(areaWidth >= 240 ? ['LEAD'] : []), 'NAME', ...(areaWidth >= 320 ? ['POWER'] : []), ...(areaWidth >= 400 ? ['ITEM'] : [])];
      await expect(second.locator('thead th:visible')).toHaveText(columns);
    }
    await page.setViewportSize({ width: 390, height: 700 });
    await expect(current.locator('thead th:visible')).toHaveText(['NO', 'NAME']);
    await expect(second.locator('thead th:visible')).toHaveText(['NO', 'NAME']);
    await page.screenshot({ path: 'test-results/troop-rosters-mobile.png', fullPage: true });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise; const exported = new Uint8Array(await readFile((await download.path())!));
    expect(exported.slice(0x59a6, 0x79a6)).toEqual(new Uint8Array(bytes.slice(0x59a6, 0x79a6)));
    expect(exported.slice(0x9a6, 0x59a6)).toEqual(new Uint8Array(bytes.slice(0x9a6, 0x59a6)));
    validateSave(exported);
  } finally { await browser.close(); }
});


test('web: second troop roster previews resize and show an ellipsis for hidden members', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  try {
    const bytes = editTroop(new Uint8Array(save()), 0, { members: Array(20).fill(220) });
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'preview.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const picker = modal.getByRole('table', { name: '제2부대 선택 목록', exact: true });
    const row = picker.getByRole('row', { name: /제2부대 NO 7 / });
    const roster = row.locator('[data-column="ROSTER"]');
    await expect(roster).toBeVisible(); await expect(roster.locator('.roster-more')).toBeVisible();
    await expect.poll(() => roster.locator('img').count()).toBeGreaterThan(0);
    expect(await roster.locator('img').count()).toBeLessThan(20);
    await page.screenshot({ path: 'test-results/troop-compact-names-roster.png', fullPage: true });
    await page.setViewportSize({ width: 1000, height: 900 }); await expect(roster).toBeHidden();
    await page.setViewportSize({ width: 1600, height: 1000 }); await expect(roster).toBeVisible();
    await expect.poll(() => roster.locator('img').count()).toBeGreaterThan(0);
    await expect(roster.locator('.roster-more')).toBeVisible();
  } finally { await browser.close(); }
});


test('web: roster layout toggles and independent comparison filters preserve data and selections', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 2200, height: 1000 } });
  try {
    const clone = applyTroopMacro(new Uint8Array(save()), 0, 'clone-allied');
    let bytes = editTroop(clone.data, clone.index, { state: 1, id: 30, members: [0], allowAresMove: true });
    bytes = editTroop(bytes, 1, { members: [220, 260] });
    bytes[0x9a6 + 220 * 32 + 13] = 0x10; bytes[0x9a6 + 639 * 32 + 13] = 0x90;
    const total = parseSave(bytes).characters.length;
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'three-panes.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const second = modal.getByRole('group', { name: '제2부대', exact: true });
    const third = modal.getByRole('group', { name: '제3부대', exact: true });
    const layout = modal.getByRole('group', { name: '부대 비교 배치', exact: true });
    await expect(layout.getByRole('button', { name: '2단 보기', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(4);
    await expect(modal.locator('.troop-roster-group').nth(2)).toBeHidden();
    await layout.getByRole('button', { name: '3단 보기', exact: true }).click();
    await expect(third.getByRole('table').locator('tbody tr')).toHaveCount(4);
    await second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }).selectOption('allies');
    await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(3);
    await expect(third.getByRole('table').locator('tbody tr')).toHaveCount(4);
    await second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }).selectOption('named');
    await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(4);
    await third.getByRole('combobox', { name: '제3부대 캐릭터 필터', exact: true }).selectOption('allied-characters');
    await expect(third.getByRole('table').locator('tbody [data-column="ID"]')).toHaveText(['0', '220', '260']);
    await second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }).selectOption('all');
    await second.getByRole('row', { name: /제2부대 NO 30 / }).click();
    await expect(second.getByRole('table', { name: '제2부대원 목록', exact: true }).locator('tbody tr')).toHaveCount(1);
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters');
    await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(total);
    await expect(third.getByRole('table').locator('tbody tr')).toHaveCount(3);
    await page.screenshot({ path: 'test-results/troop-three-panes.png', fullPage: true });
    await layout.getByRole('button', { name: '현재 부대만', exact: true }).click();
    await expect(modal.locator('.troop-roster-group').nth(1)).toBeHidden();
    await expect(modal.locator('.troop-roster-group').nth(2)).toBeHidden();
    await expect(modal.getByRole('table', { name: '현재 부대원 목록', exact: true }).locator('thead th:visible')).toHaveCount(17);
    await layout.getByRole('button', { name: '2단 보기', exact: true }).click();
    await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(total);
    await layout.getByRole('button', { name: '3단 보기', exact: true }).click();
    await expect(third.getByRole('table').locator('tbody tr')).toHaveCount(3);
    await third.getByRole('combobox', { name: '제3부대 캐릭터 필터', exact: true }).selectOption('characters');
    await expect(third.getByRole('table').locator('tbody tr')).toHaveCount(total);
    await third.getByRole('combobox', { name: '제3부대 부대 필터', exact: true }).selectOption('all');
    await third.getByRole('row', { name: /제3부대 NO 7 / }).click();
    await expect(third.getByRole('table', { name: '제3부대원 목록', exact: true }).locator('tbody tr')).toHaveCount(3);
    await page.setViewportSize({ width: 390, height: 700 });
    await expect(second).toBeVisible();
    await expect(layout.getByRole('button', { name: '3단 보기', exact: true })).toHaveCount(0);
    await expect(layout.getByRole('button', { name: '2단 보기', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const panels = modal.locator('.troop-roster-group');
    await expect(panels.nth(2)).toBeHidden();
    expect((await panels.nth(1).boundingBox())!.y).toBe((await panels.nth(0).boundingBox())!.y);
    await page.setViewportSize({ width: 839, height: 1000 });
    await expect(layout.getByRole('button', { name: '3단 보기', exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 840, height: 1000 });
    await expect(layout.getByRole('button', { name: '3단 보기', exact: true })).toBeVisible();
    await layout.getByRole('button', { name: '3단 보기', exact: true }).click();
    await expect(third.getByRole('table', { name: '제3부대원 목록', exact: true })).toBeVisible();
    expect((await panels.nth(2).boundingBox())!.y).toBe((await panels.nth(0).boundingBox())!.y);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.screenshot({ path: 'test-results/troop-three-panes-mobile.png', fullPage: true });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise; const exported = new Uint8Array(await readFile((await download.path())!));
    expect(exported.slice(0x9a6, 0x79a6)).toEqual(bytes.slice(0x9a6, 0x79a6)); validateSave(exported);
  } finally { await browser.close(); }
});


test('web: member selection swaps slots across three panes and character lists replace without pool swaps', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1100 } });
  try {
    let bytes = editTroop(new Uint8Array(save()), 1, { members: [230, 231] });
    bytes = editTroop(bytes, 2, { state: 1, id: 31, members: [240, 241] });
    bytes = editTroop(bytes, 3, { members: [260] });
    bytes[0x9a6 + 220 * 32 + 13] = 0x10; bytes[0x9a6 + 260 * 32 + 13] = 0x10;
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'swap.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await modal.getByRole('button', { name: '3단 보기', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true });
    const second = modal.getByRole('group', { name: '제2부대', exact: true });
    const third = modal.getByRole('group', { name: '제3부대', exact: true });
    const rows = current.locator('tbody tr');
    await rows.nth(0).click(); await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(rows.nth(0)).toHaveCSS('background-color', 'rgb(0, 195, 0)');
    await rows.nth(0).click(); await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false');
    await rows.nth(0).click(); await rows.nth(1).click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['221', '220', '639']);
    await second.getByRole('row', { name: /제2부대 NO 253 / }).click();
    const secondTable = second.getByRole('table', { name: '제2부대원 목록', exact: true });
    await rows.nth(0).click(); await secondTable.locator('tbody tr').nth(1).click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['231', '220', '639']);
    await expect(secondTable.locator('tbody [data-column="ID"]')).toHaveText(['230', '221']);
    await third.getByRole('combobox', { name: '제3부대 부대 필터', exact: true }).selectOption('all');
    await third.getByRole('row', { name: /제3부대 NO 31 / }).click();
    const thirdTable = third.getByRole('table', { name: '제3부대원 목록', exact: true });
    await secondTable.locator('tbody tr').nth(0).press('Enter'); await thirdTable.locator('tbody tr').nth(0).press('Space');
    await expect(secondTable.locator('tbody [data-column="ID"]')).toHaveText(['240', '221']);
    await expect(thirdTable.locator('tbody [data-column="ID"]')).toHaveText(['230', '241']);
    await second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }).selectOption('all');
    await second.getByRole('row', { name: /제2부대 NO 7 / }).click();
    await rows.nth(1).click(); await secondTable.locator('tbody tr').nth(1).click();
    await expect(modal.locator('.roster-member-row[aria-selected="true"]')).toHaveCount(0);
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['231', '220', '639']);
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters');
    const pool = second.getByRole('table');
    await pool.locator('tbody tr').nth(240).click(); await pool.locator('tbody tr').nth(241).click();
    await expect(modal.locator('.roster-member-row[aria-selected="true"]')).toHaveCount(0);
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['231', '220', '639']);
    await rows.nth(2).click(); await pool.locator('tbody tr').nth(250).click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['231', '220', '250']);
    await third.getByRole('combobox', { name: '제3부대 캐릭터 필터', exact: true }).selectOption('allied-characters');
    await third.getByRole('table').locator('tbody tr').filter({ has: page.locator('[data-column="ID"]', { hasText: /^260$/ }) }).click(); await rows.nth(1).click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['231', '260', '250']);
    await expect(modal.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/troop-member-exchange.png', fullPage: true });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise; const exported = new Uint8Array(await readFile((await download.path())!));
    const troops = parseSave(exported).troops;
    expect(troops[0].members).toEqual([231, 260, 250]); expect(troops[1].members).toEqual([240, 221]); expect(troops[2].members).toEqual([230, 241]);
    expect(exported.slice(0x9a6, 0x59a6)).toEqual(bytes.slice(0x9a6, 0x59a6)); validateSave(exported);
  } finally { await browser.close(); }
});

test('web: member drag swaps live on hover and follows the dragged member across troops', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1100 } });
  try {
    const bytes = editTroop(new Uint8Array(save()), 1, { members: [230, 231] });
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'drag-troops.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true });
    const second = modal.getByRole('group', { name: '제2부대', exact: true });
    await second.getByRole('row', { name: /제2부대 NO 253 / }).click();
    const target = second.getByRole('table', { name: '제2부대원 목록', exact: true });
    const dragData = await page.evaluateHandle(() => new DataTransfer());
    await current.locator('tbody tr').nth(2).dispatchEvent('dragstart', { dataTransfer: dragData });
    await current.locator('tbody tr').nth(1).dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['220', '639', '221']);
    await current.locator('tbody tr').nth(0).dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['639', '220', '221']);
    await target.locator('tbody tr').nth(0).dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['230', '220', '221']);
    await expect(target.locator('tbody [data-column="ID"]')).toHaveText(['639', '231']);
    await target.locator('tbody tr').nth(0).dispatchEvent('dragover', { dataTransfer: dragData });
    await expect(target.locator('tbody [data-column="ID"]')).toHaveText(['639', '231']);
    await target.locator('tbody tr').nth(0).dispatchEvent('drop', { dataTransfer: dragData });
    await expect(modal.locator('.roster-member-row[aria-selected="true"]')).toHaveCount(0);
    await current.locator('tbody tr').nth(0).dragTo(current.locator('tbody tr').nth(1));
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['220', '230', '221']);
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters');
    const pool = second.getByRole('table');
    const replacementData = await page.evaluateHandle(() => new DataTransfer());
    await pool.locator('tbody tr').nth(250).dispatchEvent('dragstart', { dataTransfer: replacementData });
    await current.locator('tbody tr').nth(2).dispatchEvent('dragover', { dataTransfer: replacementData });
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['220', '230', '250']);
    await current.locator('tbody tr').nth(1).dispatchEvent('dragover', { dataTransfer: replacementData });
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['220', '250', '230']);
    await current.locator('tbody tr').nth(1).dispatchEvent('drop', { dataTransfer: replacementData });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise; const exported = new Uint8Array(await readFile((await download.path())!));
    expect(parseSave(exported).troops[0].members).toEqual([220, 250, 230]); expect(parseSave(exported).troops[1].members).toEqual([639, 231]);
    expect(exported.slice(0x9a6, 0x59a6)).toEqual(bytes.slice(0x9a6, 0x59a6)); validateSave(exported);
  } finally { await browser.close(); }
});


test('web: NEW reorders, transfers, adds characters and accepts live dragging', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1100 } });
  try {
    let bytes = editTroop(new Uint8Array(save()), 1, { members: [230, 231] });
    bytes = editTroop(bytes, 2, { state: 1, id: 31, members: [240] });
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'new-slot.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await modal.getByRole('button', { name: '3단 보기', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true }); const newCurrent = current.locator('tfoot .roster-new-row');
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); const third = modal.getByRole('group', { name: '제3부대', exact: true });
    await expect(newCurrent).toHaveText(/NEW/); await newCurrent.click(); await expect(newCurrent).toHaveCSS('background-color', 'rgb(0, 195, 0)');
    await current.locator('tbody tr').nth(0).click(); await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['221', '639', '220']);
    await second.getByRole('row', { name: /제2부대 NO 253 / }).click(); const secondTable = second.getByRole('table');
    await secondTable.locator('tbody tr').nth(0).click(); await newCurrent.click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['221', '639', '220', '230']); await expect(secondTable.locator('tbody [data-column="ID"]')).toHaveText(['231']);
    await third.getByRole('combobox', { name: '제3부대 부대 필터', exact: true }).selectOption('all');
    await third.getByRole('row', { name: /제3부대 NO 31 / }).click(); const thirdTable = third.getByRole('table');
    await newCurrent.click(); await thirdTable.locator('tbody tr').nth(0).click();
    await expect(current.locator('tbody tr')).toHaveCount(5); await expect(thirdTable.locator('tbody tr')).toHaveCount(0); await expect(thirdTable.locator('tfoot .roster-new-row')).toBeVisible();
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters'); const pool = second.getByRole('table');
    await expect(pool.locator('.roster-new-row')).toHaveCount(0);
    await newCurrent.click(); await pool.locator('tbody tr').nth(250).click();
    await pool.locator('tbody tr').nth(251).click(); await newCurrent.click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['221', '639', '220', '230', '240', '250', '251']);
    await newCurrent.click(); await thirdTable.locator('tfoot .roster-new-row').click(); await expect(current.locator('tbody tr')).toHaveCount(7);
    await thirdTable.locator('tfoot .roster-new-row').click(); await current.locator('tbody tr').nth(0).click();
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['639', '220', '230', '240', '250', '251']); await expect(thirdTable.locator('tbody [data-column="ID"]')).toHaveText(['221']);
    const drag = await page.evaluateHandle(() => new DataTransfer());
    await current.locator('tbody tr').last().dispatchEvent('dragstart', { dataTransfer: drag });
    await thirdTable.locator('tfoot .roster-new-row').dispatchEvent('dragover', { dataTransfer: drag });
    await expect(thirdTable.locator('tbody [data-column="ID"]')).toHaveText(['221', '251']); await expect(current.locator('tbody tr')).toHaveCount(5);
    await thirdTable.locator('tbody tr').last().dispatchEvent('drop', { dataTransfer: drag });
    const addDrag = await page.evaluateHandle(() => new DataTransfer());
    await pool.locator('tbody tr').nth(254).dispatchEvent('dragstart', { dataTransfer: addDrag });
    await newCurrent.dispatchEvent('dragover', { dataTransfer: addDrag });
    await expect(current.locator('tbody [data-column="ID"]')).toHaveText(['639', '220', '230', '240', '250', '254']);
    await current.locator('tbody tr').last().dispatchEvent('drop', { dataTransfer: addDrag });
    await expect(modal.getByTestId('troop-member-count')).toHaveText('6명');
    await page.screenshot({ path: 'test-results/troop-new-row.png', fullPage: true });
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const download = await downloadPromise; const exported = new Uint8Array(await readFile((await download.path())!)); const troops = parseSave(exported).troops;
    expect(troops[0].members).toEqual([639, 220, 230, 240, 250, 254]); expect(troops[1].members).toEqual([231]); expect(troops[2].members).toEqual([221, 251]);
    expect(exported.slice(0x9a6, 0x59a6)).toEqual(bytes.slice(0x9a6, 0x59a6)); validateSave(exported);
  } finally { await browser.close(); }
});

test('web: NEW disappears at 18 members and returns after moving one out', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  try {
    const bytes = editTroop(new Uint8Array(save()), 0, { members: Array.from({ length: 17 }, (_, index) => 220 + index) });
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'capacity.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check(); await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true }); const second = modal.getByRole('group', { name: '제2부대', exact: true });
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters'); await current.locator('tfoot .roster-new-row').click(); await second.getByRole('table').locator('tbody tr').nth(500).click();
    await expect(current.locator('tbody tr')).toHaveCount(18); await expect(current.locator('.roster-new-row')).toHaveCount(0);
    await second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }).selectOption('all'); await second.getByRole('row', { name: /제2부대 NO 253 / }).click();
    await current.locator('tbody tr').last().click(); await second.getByRole('table').locator('tfoot .roster-new-row').click();
    await expect(current.locator('tbody tr')).toHaveCount(17); await expect(current.locator('.roster-new-row')).toBeVisible(); await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(2);
  } finally { await browser.close(); }
});


test('web: comparison dropdowns sit above groups and filter characters by roster and name', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1100 } });
  try {
    let bytes = editTroop(new Uint8Array(save()), 0, { state: 0, id: 0 });
    bytes = editTroop(bytes, 2, { state: 0x30, id: 40, members: [261] });
    const setName = (index: number, name: number) => { bytes[0x9a6 + index * 32 + 2] = name & 255; bytes[0x9a6 + index * 32 + 3] = name >>> 8; };
    setName(219, 1); setName(230, 1); bytes[0x9a6 + 260 * 32 + 13] = 0x10;
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'dropdowns.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('row', { name: '부대 1 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await modal.getByRole('button', { name: '3단 보기', exact: true }).click();
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); const third = modal.getByRole('group', { name: '제3부대', exact: true });
    const troopFilter = second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }); const charFilter = second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true });
    await expect(troopFilter.locator('option:not([disabled])')).toHaveText(['아군부대', '네임드부대', '전체부대']);
    await expect(charFilter.locator('option:not([disabled])')).toHaveText(['아군캐릭터', '네임드캐릭터', '전체캐릭터']);
    const fieldset = second.locator('fieldset');
    expect((await troopFilter.boundingBox())!.y).toBeLessThan((await fieldset.boundingBox())!.y);
    await expect(second.getByRole('button', { name: '부대 목록', exact: true })).toHaveCount(0);
    await second.getByRole('row', { name: /제2부대 NO 1 / }).click();
    await expect(fieldset.locator('legend')).toHaveText('NO 1 · 아레스 · 3명');
    await expect(second.locator('.second-troop-heading')).toHaveCount(0);
    const back = second.getByRole('button', { name: '부대 목록', exact: true }); await expect(back).toHaveText('↶');
    expect((await back.boundingBox())!.y).toBe((await troopFilter.boundingBox())!.y);
    await back.click(); await expect(fieldset.locator('legend')).toHaveText('제2부대'); await expect(back).toHaveCount(0);
    await charFilter.selectOption('allied-characters');
    await expect(second.getByRole('table').locator('tbody [data-column="ID"]')).toHaveText(['0', '220', '221', '639']);
    await expect(fieldset.locator('legend')).toHaveText('아군캐릭터 · 4명'); await expect(back).toHaveCount(0);
    await expect(second.locator('.comparison-list-caption')).toHaveCount(0);
    await charFilter.selectOption('named-characters');
    await expect(fieldset.locator('legend')).toHaveText('네임드캐릭터 · 4명');
    await expect(second.getByRole('table').locator('tbody [data-column="ID"]')).toHaveText(['220', '221', '230', '639']);
    await charFilter.selectOption('characters'); await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(parseSave(bytes).characters.length);
    await third.getByRole('row', { name: /제3부대 NO 253 / }).click(); await expect(third.locator('legend')).toHaveText('NO 253 · 병사1 · 1명');
    await expect(third.getByRole('button', { name: '부대 목록', exact: true })).toBeVisible();
    await expect(second.getByRole('table').locator('tbody tr')).toHaveCount(parseSave(bytes).characters.length);
    await page.screenshot({ path: 'test-results/troop-comparison-dropdowns.png', fullPage: true });
    await troopFilter.selectOption('named'); await expect(fieldset.locator('legend')).toHaveText('제2부대'); await expect(second.getByRole('table', { name: '제2부대 선택 목록', exact: true })).toBeVisible();
  } finally { await browser.close(); }
});


test('web: comparison troop filters inherit the main list only when the modal opens', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  try {
    const bytes = editTroop(new Uint8Array(save()), 0, { state: 0, id: 0 });
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'inherit.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    const open = async () => { await page.getByRole('row', { name: '부대 1 편집', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await modal.getByRole('button', { name: '3단 보기', exact: true }).click(); };
    const second = modal.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }); const third = modal.getByRole('combobox', { name: '제3부대 부대 필터', exact: true });
    await open(); await expect(second).toHaveValue('named'); await expect(third).toHaveValue('named');
    await second.selectOption('all'); await expect(third).toHaveValue('named');
    await modal.getByRole('tab', { name: '부대 정보', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await expect(second).toHaveValue('all'); await expect(third).toHaveValue('named');
    await modal.getByRole('button', { name: '현재 부대만', exact: true }).click(); await modal.getByRole('button', { name: '3단 보기', exact: true }).click(); await expect(second).toHaveValue('all');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); await open(); await expect(second).toHaveValue('named');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('radio', { name: '아군 부대 보기', exact: true }).check(); await open(); await expect(second).toHaveValue('allies'); await expect(third).toHaveValue('allies');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('radio', { name: '전체 부대 보기', exact: true }).check(); await open(); await expect(second).toHaveValue('all'); await expect(third).toHaveValue('all');
  } finally { await browser.close(); }
});


test('web: comparison panes inherit inactive visibility even after changing troop filters', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  try {
    let bytes = editTroop(new Uint8Array(save()), 0, { state: 0, id: 0 }); bytes = editTroop(bytes, 2, { state: 0x30, id: 40, members: [639] });
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'inactive-inherit.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) }); await page.getByRole('button', { name: '부대', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    const open = async () => { await page.getByRole('row', { name: '부대 1 편집', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await modal.getByRole('button', { name: '3단 보기', exact: true }).click(); };
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); const third = modal.getByRole('group', { name: '제3부대', exact: true });
    await open(); await expect(second.getByRole('row', { name: /제2부대 NO 40 / })).toHaveCount(0); await expect(third.getByRole('row', { name: /제3부대 NO 40 / })).toHaveCount(0);
    await second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true }).selectOption('all'); await expect(second.getByRole('row', { name: /제2부대 NO 40 / })).toHaveCount(0);
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await open(); await expect(second.getByRole('row', { name: /제2부대 NO 40 / })).toBeVisible(); await expect(third.getByRole('row', { name: /제3부대 NO 40 / })).toBeVisible();
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); await page.getByRole('radio', { name: '전체 부대 보기', exact: true }).check(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).uncheck();
    await open(); await expect(second.getByRole('combobox', { name: '제2부대 부대 필터', exact: true })).toHaveValue('all'); await expect(second.getByRole('row', { name: /제2부대 NO 40 / })).toHaveCount(0);
  } finally { await browser.close(); }
});


test('web: Ares moves only after confirming game risk for swap, replacement, NEW and drag', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  try {
    const bytes = editTroop(new Uint8Array(save()), 0, { state: 0, id: 0 });
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'ares-confirm.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) }); await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('row', { name: '부대 1 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const table = modal.getByRole('table', { name: '현재 부대원 목록', exact: true }); const rows = table.locator('tbody tr');
    let warnings = 0; page.on('dialog', dialog => { if (dialog.message().startsWith('아레스를')) warnings++; });
    const confirmRisk = (accept: boolean) => page.once('dialog', async dialog => { expect(dialog.type()).toBe('confirm'); expect(dialog.message()).toContain('게임에 문제가 발생할 수 있습니다'); if (accept) await dialog.accept(); else await dialog.dismiss(); });
    const reset = async () => { page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: '부대 RESET', exact: true }).click(); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['220', '221', '639']); };
    await rows.nth(0).click(); await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true'); expect(warnings).toBe(0);
    confirmRisk(false); await rows.nth(1).click(); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['220', '221', '639']); await expect.poll(() => warnings).toBe(1);
    await rows.nth(1).click(); confirmRisk(true); await rows.nth(0).click(); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['221', '220', '639']); await reset();
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); await second.getByRole('row', { name: /제2부대 NO 1 / }).click();
    await second.getByRole('table').locator('tbody tr').nth(0).click(); confirmRisk(true); await table.locator('tfoot .roster-new-row').click(); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['221', '639', '220']); await reset();
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters'); const pool = second.getByRole('table');
    await pool.locator('tbody tr').nth(230).click(); await expect(pool.locator('tbody tr').nth(230)).toHaveAttribute('aria-selected', 'true'); const beforeCancel = warnings; confirmRisk(false); await rows.nth(0).click(); await expect.poll(() => warnings).toBe(beforeCancel + 1); await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false'); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['220', '221', '639']);
    await pool.locator('tbody tr').nth(230).click(); await expect(pool.locator('tbody tr').nth(230)).toHaveAttribute('aria-selected', 'true'); confirmRisk(true); await rows.nth(0).click(); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['230', '221', '639']); await reset();
    const cancelledDrag = await page.evaluateHandle(() => new DataTransfer()); await rows.nth(0).dispatchEvent('dragstart', { dataTransfer: cancelledDrag }); confirmRisk(false); await rows.nth(1).dispatchEvent('dragover', { dataTransfer: cancelledDrag }); await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['220', '221', '639']);
    const drag = await page.evaluateHandle(() => new DataTransfer()); await rows.nth(0).dispatchEvent('dragstart', { dataTransfer: drag }); const previousWarnings = warnings; confirmRisk(true); await table.locator('tfoot .roster-new-row').dispatchEvent('dragover', { dataTransfer: drag });
    await expect(table.locator('tbody [data-column="ID"]')).toHaveText(['221', '639', '220']); await rows.last().dispatchEvent('drop', { dataTransfer: drag }); expect(warnings).toBe(previousWarnings + 1);
    await expect(modal.locator('.troop-lock-toast')).toHaveCount(0); await expect(modal.getByRole('alert')).toHaveCount(0);
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click(); const download = await downloadPromise; const exported = new Uint8Array(await readFile((await download.path())!));
    expect(parseSave(exported).troops[0].members).toEqual([221, 639, 220]); expect(exported.slice(0x9a6, 0x59a6)).toEqual(bytes.slice(0x9a6, 0x59a6)); validateSave(exported);
  } finally { await browser.close(); }
});


test('web: roster changes highlight whole rows and star slot numbers against original data', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  try {
    const bytes = editTroop(new Uint8Array(save()), 1, { members: [230] });
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'member-highlights.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) }); await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check(); await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true }); const rows = current.locator('tbody tr');
    await rows.nth(0).click(); await rows.nth(1).click(); await expect(current.locator('tbody [data-column="NO"]')).toHaveText(['1*', '2*', '3']);
    for (const cell of await rows.nth(0).locator('td:visible').all()) await expect(cell).toHaveCSS('color', 'rgb(247, 247, 0)');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); await page.getByRole('row', { name: '부대 7 편집', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await expect(current.locator('tbody [data-column="NO"]')).toHaveText(['1*', '2*', '3']); await rows.nth(0).click(); await rows.nth(1).click(); await expect(current.locator('tbody [data-column="NO"]')).toHaveText(['1', '2', '3']);
    await expect(rows.nth(0).locator('[data-column="NAME"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); await second.getByRole('row', { name: /제2부대 NO 253 / }).click(); const secondTable = second.getByRole('table');
    await rows.nth(0).click(); await secondTable.locator('tbody tr').first().click(); await expect(rows.nth(0).locator('[data-column="NO"]')).toHaveText('1*'); await expect(secondTable.locator('tbody [data-column="NO"]')).toHaveText(['1*']);
    await expect(secondTable.locator('tbody [data-column="NAME"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await rows.nth(0).click(); await secondTable.locator('tbody tr').first().click(); await expect(secondTable.locator('tbody [data-column="NO"]')).toHaveText(['1']);
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters'); await current.locator('tfoot .roster-new-row').click(); await second.getByRole('table').locator('tbody tr').nth(250).click();
    await expect(current.locator('tbody [data-column="NO"]')).toHaveText(['1', '2', '3', '4*']); await expect(rows.last().locator('[data-column="NAME"]')).toHaveCSS('color', 'rgb(247, 247, 0)');
    page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: '부대 RESET', exact: true }).click(); await expect(current.locator('tbody [data-column="NO"]')).toHaveText(['1', '2', '3']);
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); await page.getByRole('button', { name: '캐릭터', exact: true }).click(); await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const characterModal = page.getByRole('dialog', { name: 'ID 220', exact: true }); await characterModal.getByLabel('AT', { exact: true }).fill('1'); await characterModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check(); await page.getByRole('row', { name: '부대 7 편집', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await expect(rows.nth(0).locator('[data-column="NO"]')).toHaveText('1*'); await expect(rows.nth(0).locator('[data-column="ID"]')).toHaveText('220');
    for (const cell of await rows.nth(0).locator('td:visible').all()) await expect(cell).toHaveCSS('color', 'rgb(247, 247, 0)');
    await page.screenshot({ path: 'test-results/troop-member-highlights.png', fullPage: true });
  } finally { await browser.close(); }
});


test('web: modified troop picker rows keep nation color and mark leader names', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1100 } });
  try {
    const bytes = new Uint8Array(save()); bytes[0x59a6 + 5] = 0x1d;
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'troop-list-changes.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) }); await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('radio', { name: '전체 부대 보기', exact: true }).check(); await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByLabel('이동 명령', { exact: true }).selectOption('254');
    const mainRow = page.locator('.troop-table tbody tr[aria-label="부대 7 편집"]');
    await expect(mainRow.locator('[data-column="NAME"]')).toHaveText('아레스*');
    await expect(mainRow.locator('[data-column="NATION"]')).toHaveCSS('color', 'rgb(247, 0, 0)');
    for (const cell of await mainRow.locator('td:not([data-column="NATION"]):visible').all()) await expect(cell).toHaveCSS('color', 'rgb(247, 247, 0)');
 await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await modal.getByRole('button', { name: '3단 보기', exact: true }).click();
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); const third = modal.getByRole('group', { name: '제3부대', exact: true });
    const row = (pane: typeof second) => pane.getByRole('row', { name: new RegExp(`제${pane === second ? 2 : 3}부대 NO 7 `) });
    for (const pane of [second, third]) {
      await expect(row(pane).locator('[data-column="NAME"]')).toHaveText('아레스*');
      await expect(row(pane).locator('[data-column="NATION"]')).toHaveCSS('color', 'rgb(247, 0, 0)');
      for (const cell of await row(pane).locator('td:not([data-column="NATION"]):visible').all()) await expect(cell).toHaveCSS('color', 'rgb(247, 247, 0)');
    }
    page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: '부대 RESET', exact: true }).click(); await expect(row(second).locator('[data-column="NAME"]')).toHaveText('아레스'); await expect(row(second).locator('[data-column="NAME"]')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await second.getByRole('row', { name: /제2부대 NO 253 / }).click(); const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true }); const other = second.getByRole('table');
    await current.locator('tbody tr').first().click(); await other.locator('tbody tr').first().click(); await expect(row(third).locator('[data-column="NAME"]')).toHaveText('(이름없음)*'); await expect(third.getByRole('row', { name: /제3부대 NO 253 / }).locator('[data-column="NAME"]')).toHaveText('병사1*');
    await current.locator('tbody tr').first().click(); await other.locator('tbody tr').first().click(); await expect(row(third).locator('[data-column="NAME"]')).toHaveText('아레스');
    await second.getByRole('button', { name: '부대 목록', exact: true }).click();
    await modal.getByRole('tab', { name: '부대 정보', exact: true }).click(); await modal.getByRole('button', { name: '아군부대로 복제', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await expect(third.getByRole('row', { name: /제3부대 NO 1 / }).locator('[data-column="NAME"]')).toHaveText('아레스*'); await expect(row(third).locator('[data-column="NAME"]')).toHaveText('아레스');
    await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click(); await page.getByRole('button', { name: '캐릭터', exact: true }).click(); await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const charModal = page.getByRole('dialog', { name: 'ID 220', exact: true }); await charModal.getByLabel('AT', { exact: true }).fill('1'); await charModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check(); await page.getByRole('row', { name: '부대 7 편집', exact: true }).click(); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await expect(row(second).locator('[data-column="NAME"]')).toHaveText('아레스*');
    await page.screenshot({ path: 'test-results/troop-list-change-highlights.png', fullPage: true });
  } finally { await browser.close(); }
});


test('web: roster sprite backgrounds mark only changed members in main and comparison lists', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 2200, height: 1100 } });
  try {
    await page.goto('http://127.0.0.1:5174'); await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'sprite-changes.dat', mimeType: 'application/octet-stream', buffer: save() }); await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    const mainRow = page.locator('.troop-table tbody tr[aria-label="부대 7 편집"]'); await expect(mainRow.locator('.roster-image-changed')).toHaveCount(0); await mainRow.click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true }); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await modal.getByRole('button', { name: '3단 보기', exact: true }).click();
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true }); const rows = current.locator('tbody tr');
    const second = modal.getByRole('group', { name: '제2부대', exact: true }); const third = modal.getByRole('group', { name: '제3부대', exact: true }); const otherRow = (pane: typeof second, n: number) => pane.getByRole('row', { name: new RegExp(`제${n}부대 NO 7 `) });
    await rows.nth(0).click(); await rows.nth(1).click();
    for (const row of [mainRow, otherRow(second, 2), otherRow(third, 3)]) {
      await expect(row.locator('.roster-image-changed')).toHaveCount(2); await expect(row.locator('.roster-image').nth(0)).toHaveCSS('background-color', 'rgb(247, 247, 0)'); await expect(row.locator('.roster-image').nth(2)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    }
    await rows.nth(0).click(); await rows.nth(1).click(); await expect(mainRow.locator('.roster-image-changed')).toHaveCount(0); await expect(otherRow(second, 2).locator('.roster-image-changed')).toHaveCount(0);
    await modal.getByRole('tab', { name: '부대 정보', exact: true }).click(); await modal.getByLabel('이동 명령', { exact: true }).selectOption('254'); await modal.getByRole('tab', { name: '부대 편성', exact: true }).click(); await expect(otherRow(third, 3).locator('.roster-image-changed')).toHaveCount(0);
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters'); await current.locator('tfoot .roster-new-row').click(); await second.getByRole('table').locator('tbody tr').nth(250).click(); await expect(otherRow(third, 3).locator('.roster-image-changed')).toHaveCount(1); await expect(otherRow(third, 3).locator('.roster-image').nth(3)).toHaveCSS('background-color', 'rgb(247, 247, 0)');
    page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: '부대 RESET', exact: true }).click(); await expect(mainRow.locator('.roster-image-changed')).toHaveCount(0); await modal.getByRole('button', { name: '부대 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '캐릭터', exact: true }).click(); await page.getByRole('row', { name: '아레스 편집', exact: true }).click(); const charModal = page.getByRole('dialog', { name: 'ID 220', exact: true }); await charModal.getByLabel('AT', { exact: true }).fill('1'); await charModal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click(); await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check(); await expect(mainRow.locator('.roster-image-changed')).toHaveCount(1); await expect(mainRow.locator('.roster-image').nth(0)).toHaveCSS('background-color', 'rgb(247, 247, 0)');
    await page.screenshot({ path: 'test-results/troop-roster-sprite-highlights.png', fullPage: true });
  } finally { await browser.close(); }
});


test('web: up to five roster panes follow width thresholds and share member editing', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1100 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'five-panes.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(save()) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await modal.getByRole('tab', { name: '부대 편성', exact: true }).click();
    await modal.getByRole('button', { name: '5단 보기', exact: true }).click();
    await expect(modal.getByRole('button', { name: '6단 보기', exact: true })).toHaveCount(0);
    const current = modal.getByRole('table', { name: '현재 부대원 목록', exact: true });
    const top = (await current.boundingBox())!.y;
    for (const number of [2, 3, 4, 5]) {
      const pane = modal.getByRole('group', { name: `제${number}부대`, exact: true });
      await expect(pane.getByRole('table')).toBeVisible();
      expect(Math.abs((await pane.getByRole('table').boundingBox())!.y - top)).toBeLessThan(4);
    }
    const fifth = modal.getByRole('group', { name: '제5부대', exact: true });
    await fifth.getByRole('row', { name: /제5부대 NO 253 / }).click();
    await current.locator('tbody tr').first().click();
    await fifth.getByRole('table').locator('tbody tr').first().click();
    await expect(current.locator('tbody tr').first().locator('[data-column="NO"]')).toHaveText('1*');
    await expect(fifth.getByRole('table').locator('tbody tr').first().locator('[data-column="NO"]')).toHaveText('1*');
    for (const [width, maximum] of [[1399, 4], [1119, 3], [839, 2]]) {
      await page.setViewportSize({ width, height: 1100 });
      await expect(modal.getByRole('button', { name: `${maximum}단 보기`, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(modal.getByRole('button', { name: `${maximum + 1}단 보기`, exact: true })).toHaveCount(0);
    }
    await page.setViewportSize({ width: 1800, height: 1100 });
    await modal.getByRole('button', { name: '5단 보기', exact: true }).click();
    await expect(fifth.getByRole('table', { name: '제5부대원 목록', exact: true })).toBeVisible();
  } finally { await browser.close(); }
});


test('web: formation double click opens character editor with roster navigation and returns', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1800, height: 1000 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'formation-edit.dat', mimeType: 'application/octet-stream', buffer: Buffer.from(save()) });
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await page.getByRole('checkbox', { name: '비활성부대 보기', exact: true }).check();
    await page.getByRole('row', { name: '부대 7 편집', exact: true }).click();
    const troop = page.getByRole('dialog', { name: '부대 편집', exact: true });
    await troop.getByRole('tab', { name: '부대 편성', exact: true }).click();
    const rows = troop.getByRole('table', { name: '현재 부대원 목록', exact: true }).locator('tbody tr');
    await rows.first().dblclick();
    let editor = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('button', { name: '이전 캐릭터', exact: true })).toBeDisabled();
    await editor.getByLabel('AT', { exact: true }).fill('99');
    await editor.getByRole('button', { name: '다음 캐릭터', exact: true }).click();
    editor = page.getByRole('dialog', { name: 'ID 221', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: '다음 캐릭터', exact: true }).click();
    editor = page.getByRole('dialog', { name: 'ID 639', exact: true });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole('button', { name: '다음 캐릭터', exact: true })).toBeDisabled();
    await editor.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(troop).toBeVisible();
    await expect(rows.first().locator('[data-column="NAME"]')).toContainText('아레스');
    await expect(rows.first().locator('[data-column="NO"]')).toHaveText('1*');
    await rows.first().dispatchEvent('mousedown');
    await rows.nth(1).dispatchEvent('mouseup');
    await rows.nth(1).dispatchEvent('dblclick');
    await expect(page.locator('dialog:not(.troop-dialog)[open]')).toHaveCount(0);
    const second = troop.getByRole('group', { name: '제2부대', exact: true });
    await second.getByRole('combobox', { name: '제2부대 캐릭터 필터', exact: true }).selectOption('characters');
    await second.getByRole('table').locator('tbody tr').nth(5).dblclick();
    editor = page.getByRole('dialog', { name: 'ID 5', exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: '다음 캐릭터', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'ID 6', exact: true })).toBeVisible();
  } finally { await browser.close(); }
});


test('desktop bridge: returning to save selection refreshes disk summaries', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    const data = Array.from(save()); const summary = parseSave(new Uint8Array(data)).summary;
    await page.addInitScript(({ data, summary }) => {
      let scans = 0;
      Object.defineProperty(window, 'fq4rDesktop', { value: {
        restoreFolder: async () => ({ kind: 'folder', folder: 'C:/Game', errors: [], entries: [{ id: `scan-${++scans}`, name: 'save00.dat', summary: scans === 1 ? summary : { ...summary, locationId: 10, location: '켄트마을', playMinutes: 123, difficulty: '고투' } }] }),
        loadSave: async (id: string) => ({ name: 'save00.dat', saveId: id, data: new Uint8Array(data) }),
      } });
    }, { data, summary });
    await page.goto('http://127.0.0.1:5174');
    await page.getByRole('list', { name: '폴더의 세이브 목록' }).getByRole('button').click();
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    const list = page.getByRole('list', { name: '폴더의 세이브 목록' });
    await expect(list).toContainText('켄트마을'); await expect(list).toContainText('123분'); await expect(list).toContainText('고투');
    await expect(list.getByRole('button')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await expect(list.locator('.save-filename')).toHaveCSS('color', 'rgb(247, 247, 0)');
    await list.getByRole('button').click();
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(list.getByRole('button')).toHaveCSS('color', 'rgb(255, 255, 255)');
  } finally { await browser.close(); }
});


test('desktop bridge: save as supports cancel and updates the active file', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    await page.addInitScript(data => {
      let attempt = 0;
      Object.defineProperty(window, 'fq4rDesktop', { value: {
        restoreFolder: async () => null,
        chooseFile: async () => ({ kind: 'file', name: 'save00.dat', saveId: 'original', data: new Uint8Array(data) }),
        saveFileAs: async (_id: string, bytes: Uint8Array) => { (window as any).exportBytes = Array.from(bytes); return ++attempt === 1 ? null : { name: 'custom.dat', saveId: 'exported' }; },
        saveFile: async (id: string) => { (window as any).savedId = id; return { backupName: 'custom.bak' }; },
      } });
    }, Array.from(save()));
    await page.goto('http://127.0.0.1:5174'); await page.locator('.drop-zone').click();
    const button = page.getByRole('button', { name: '다른 이름으로 저장', exact: true });
    await button.click(); await expect(page.locator('.editor-header h2')).toHaveText('save00.dat');
    await expect(button).toBeEnabled(); await button.click(); await expect(page.locator('.editor-header h2')).toHaveText('custom.dat');
    const bytes = await page.evaluate(() => (window as any).exportBytes as number[]); validateSave(new Uint8Array(bytes));
    await page.getByRole('button', { name: '저장', exact: true }).click(); await expect.poll(() => page.evaluate(() => (window as any).savedId)).toBe('exported');
  } finally { await browser.close(); }
});


test('desktop bridge: editor saves update the baseline but later external changes highlight', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    const data = Array.from(save()); const summary = parseSave(new Uint8Array(data)).summary;
    await page.addInitScript(({ data, summary }) => {
      let diskSummary = summary; let scans = 0;
      Object.defineProperty(window, 'fq4rDesktop', { value: {
        restoreFolder: async () => ({ kind: 'folder', folder: 'C:/Game', errors: [], entries: [{ id: `scan-${++scans}`, name: 'save00.dat', summary: scans >= 3 ? { ...diskSummary, playMinutes: 77 } : diskSummary }] }),
        loadSave: async (id: string) => ({ name: 'save00.dat', saveId: id, data: new Uint8Array(data) }),
        saveFile: async (_id: string, bytes: Uint8Array) => { diskSummary = { ...summary, playMinutes: new DataView(bytes.buffer, bytes.byteOffset).getUint32(0x200, true) }; return { backupName: 'save00.bak' }; },
      } });
    }, { data, summary });
    await page.goto('http://127.0.0.1:5174');
    const list = page.getByRole('list', { name: '폴더의 세이브 목록' }); await list.getByRole('button').click();
    await page.locator('input[type="number"]').first().fill('123');
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(list).toContainText('123분'); await expect(list.getByRole('button')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await list.getByRole('button').click(); await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(list).toContainText('77분'); await expect(list.getByRole('button')).toHaveCSS('color', 'rgb(247, 247, 0)');
  } finally { await browser.close(); }
});


test('desktop bridge: external change reveals reload and refreshes the editor', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    await page.addInitScript(data => {
      let listener: (id: string) => void = () => {}; let loads = 0;
      (window as any).notifySaveChange = () => listener('watched');
      Object.defineProperty(window, 'fq4rDesktop', { value: {
        restoreFolder: async () => null,
        watchSave: async (id: string | null) => { (window as any).watchedId = id; },
        onSaveChanged: (callback: (id: string) => void) => { listener = callback; return () => { listener = () => {}; }; },
        chooseFile: async () => ({ kind: 'file', name: 'save00.dat', saveId: 'watched', data: new Uint8Array(data) }),
        loadSave: async () => { const bytes = new Uint8Array(data); new DataView(bytes.buffer).setUint32(0x200, 321, true); loads++; return { name: 'save00.dat', saveId: 'watched', data: bytes }; },
        saveFile: async () => ({ backupName: 'save00.bak' }),
      } });
    }, Array.from(save()));
    await page.goto('http://127.0.0.1:5174'); await page.locator('.drop-zone').click();
    const reload = page.getByRole('button', { name: '세이브 다시읽기', exact: true });
    await expect(reload).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as any).watchedId)).toBe('watched');
    await page.evaluate(() => (window as any).notifySaveChange()); await expect(reload).toBeVisible();
    await reload.click(); await expect(reload).toHaveCount(0); await expect(page.locator('input[type="number"]').first()).toHaveValue('321');
    await page.evaluate(() => (window as any).notifySaveChange()); await expect(reload).toBeVisible();
    await page.getByRole('button', { name: '저장', exact: true }).click(); await expect(reload).toHaveCount(0);
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).watchedId)).toBe(null);
  } finally { await browser.close(); }
});


test('web: color themes persist, style dialogs and preserve save bytes and typography', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 1000 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    const selector = page.getByRole('combobox', { name: '테마 선택', exact: true });
    await expect(selector).toHaveValue('fq4remake');
    await expect(selector.locator('option')).toHaveText(['FQ4Remake', 'Light', 'Dark', 'Dracula']);
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(32, 58, 155)');
    const font = await page.locator('.drop-copy').evaluate(element => getComputedStyle(element).fontFamily);
    await selector.selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(228, 235, 246)');
    expect(await page.locator('.drop-copy').evaluate(element => getComputedStyle(element).fontFamily)).toBe(font);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#e4ebf6');
    await page.reload(); await expect(selector).toHaveValue('light');
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(228, 235, 246)');
    const data = save();
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'themes.dat', mimeType: 'application/octet-stream', buffer: data });
    await expect(selector).toHaveValue('light');
    await expect(page.locator('.tab-panel')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await expect(page.locator('.character-table th').first()).toHaveCSS('font-size', '18px');
    await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await expect(modal).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await modal.getByLabel('AT', { exact: true }).fill('1');
    await expect(modal.getByLabel('AT', { exact: true })).toHaveCSS('color', 'rgb(138, 86, 0)');
    await modal.getByLabel('CLASS', { exact: true }).click();
    await expect(modal.locator('.class-select-options')).toBeVisible();
    await expect(modal.locator('.class-select-options')).toHaveCSS('background-color', 'rgb(244, 247, 252)');
    await page.screenshot({ path: 'test-results/theme-light-dialog.png', fullPage: true });
    await modal.getByLabel('CLASS', { exact: true }).click();
    page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: '캐릭터 RESET', exact: true }).click();
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await selector.selectOption('dark');
    await expect(page.locator('.editor-header')).toHaveCSS('background-color', 'rgb(25, 31, 41)');
    await expect(page.locator('.character-table th').first()).toHaveCSS('background-color', 'rgb(32, 39, 51)');
    await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    await expect(modal).toHaveCSS('background-color', 'rgb(32, 39, 51)');
    await page.screenshot({ path: 'test-results/theme-dark-dialog.png', fullPage: true });
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await selector.selectOption('light');
    await expect(page.locator('.troop-table tbody tr').first().locator('[data-column="NATION"]')).toHaveCSS('color', 'rgb(51, 65, 85)');
    await page.getByRole('button', { name: '아이템', exact: true }).click(); await page.screenshot({ path: 'test-results/theme-light-inventory.png', fullPage: true });
    await selector.selectOption('fq4remake');
    await expect(page.locator('.editor-header')).toHaveCSS('background-color', 'rgb(32, 58, 155)');
    await expect(page.locator('.tab-panel')).toHaveCSS('background-color', 'rgb(41, 74, 197)');
    const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: '세이브 파일 다운로드', exact: true }).click();
    const file = await downloadPromise; expect(await readFile((await file.path())!)).toEqual(data);
    await selector.selectOption('dark'); await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(selector).toHaveValue('dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'test-results/theme-dark-mobile-loading.png', fullPage: true });
    expect(await page.locator('body').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await browser.close(); }
});

test('web: theme selection handles unavailable storage and unknown theme IDs', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true }); const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('Storage unavailable'); };
      Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
    });
    await page.goto('http://127.0.0.1:5174');
    const selector = page.getByRole('combobox', { name: '테마 선택', exact: true });
    await expect(selector).toHaveValue('fq4remake'); await selector.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const other = await browser.newPage({ locale: 'ko-KR' }); await other.addInitScript(() => localStorage.setItem('fq4r-editor.theme', 'unknown-theme'));
    await other.goto('http://127.0.0.1:5174');
    await expect(other.getByRole('combobox', { name: '테마 선택', exact: true })).toHaveValue('fq4remake');
    await expect(other.locator('html')).toHaveAttribute('data-theme', 'fq4remake');
  } finally { await browser.close(); }
});


test('web: Dracula palette covers loading, editor, character dialog and persistence', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1280, height: 1000 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    const selector = page.getByRole('combobox', { name: '테마 선택', exact: true });
    await selector.selectOption('dracula');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
    await expect(page.locator('main')).toHaveCSS('background-color', 'rgb(33, 34, 44)');
    await expect(page.locator('.drop-copy')).toHaveCSS('color', 'rgb(248, 248, 242)');
    await page.reload(); await expect(selector).toHaveValue('dracula');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'dracula.dat', mimeType: 'application/octet-stream', buffer: save() });
    await expect(page.locator('.tab-panel')).toHaveCSS('background-color', 'rgb(40, 42, 54)');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#21222C');
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await expect(modal).toHaveCSS('background-color', 'rgb(40, 42, 54)');
    await expect(modal.getByLabel('AT', { exact: true })).toHaveCSS('background-color', 'rgb(52, 55, 70)');
    await modal.getByLabel('AT', { exact: true }).fill('1');
    await expect(modal.getByLabel('AT', { exact: true })).toHaveCSS('color', 'rgb(241, 250, 140)');
    await page.screenshot({ path: 'test-results/theme-dracula-dialog.png', fullPage: true });
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('button', { name: '부대', exact: true }).click();
    await expect(page.locator('.troop-table tbody tr').first().locator('[data-column="NATION"]')).toHaveCSS('color', 'rgb(248, 248, 242)');
    await page.getByRole('button', { name: '세이브 선택으로', exact: true }).click();
    await expect(selector).toHaveValue('dracula');
  } finally { await browser.close(); }
});


test('web: character POWER follows the game formula and remains visible at every width', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1920, height: 1000 } });
  try {
    const data = save(); const offset = 0x9a6 + 220 * 32;
    data[offset + 12] = 0x89; data[offset + 10] = 17; data[offset + 21] = 0x10;
    data.writeUInt16LE(999, offset + 26); data.set([73, 65, 56, 48], offset + 28);
    const character = parseSave(data).characters.find(character => character.index === 220)!;
    const originalPower = characterPower(character);
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'character-power.dat', mimeType: 'application/octet-stream', buffer: data });
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    const row = page.getByRole('row', { name: '아레스 편집', exact: true }); const cell = row.locator('[data-column="POWER"]');
    await expect(cell).toHaveText(String(originalPower));
    for (const width of [1920, 1600, 1599, 1440, 1439, 1280, 1279, 960, 959, 640, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator('.character-table th[data-column="POWER"]')).toBeVisible();
      await expect(cell).toBeVisible(); await expect(cell).toHaveText(String(originalPower));
    }
    await page.setViewportSize({ width: 1280, height: 1000 }); await row.click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await modal.getByRole('button', { name: 'FT ZERO', exact: true }).click();
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    const editedPower = characterPower({ ...character, fatigue: 0 }); expect(editedPower).not.toBe(originalPower);
    await expect(cell).toHaveText(String(editedPower)); await expect(cell).toHaveCSS('color', 'rgb(247, 247, 0)');
    await row.click(); page.once('dialog', dialog => dialog.accept()); await modal.getByRole('button', { name: '캐릭터 RESET', exact: true }).click();
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await expect(cell).toHaveText(String(originalPower)); await expect(cell).not.toHaveClass(/character-cell-changed/);
  } finally { await browser.close(); }
});


test('web: character scope filters allied troop membership and combines with modified-only', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });
  try {
    const data = save(); data[0x59a6] = 0;
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'allied.dat', mimeType: 'application/octet-stream', buffer: data });
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    const scope = page.getByRole('combobox', { name: '캐릭터 표시 범위', exact: true });
    const rows = page.locator('.character-table tbody tr');
    await expect(scope).toHaveValue('named');
    await expect(scope.locator('option[value="allied"]')).toHaveText('아군부대 캐릭터만 보기 (4명)');
    await scope.selectOption('allied');
    await expect(rows.locator('td[data-column="ID"]')).toHaveText(['0', '220', '221', '639']);
    await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await modal.getByLabel('AT', { exact: true }).fill('10');
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('checkbox', { name: '수정한 캐릭터만 표시', exact: true }).check();
    await expect(rows.locator('td[data-column="ID"]')).toHaveText(['220*']);
    await page.getByRole('button', { name: '개요', exact: true }).click();
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await expect(scope).toHaveValue('allied'); await expect(rows).toHaveCount(1);
  } finally { await browser.close(); }
});


test('web: character sorting respects filters, navigation, and toolbar alignment', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 900 } });
  try {
    const data = save(); data[0x59a6] = 0;
    data.writeUInt16LE(900, 0x9a6 + 221 * 32 + 26);
    const characters = parseSave(data).characters.filter(c => [0, 220, 221, 639].includes(c.index));
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'sort.dat', mimeType: 'application/octet-stream', buffer: data });
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    const scope = page.getByRole('combobox', { name: '캐릭터 표시 범위', exact: true });
    const sort = page.getByRole('combobox', { name: '캐릭터 정렬', exact: true });
    const ids = page.locator('.character-table tbody td[data-column="ID"]');
    await scope.selectOption('allied');
    await expect(ids).toHaveText(['0', '220', '221', '639']);
    await sort.selectOption('name');
    const named = [...characters].sort((a, b) => characterName(a.nameId).localeCompare(characterName(b.nameId), 'ko') || a.index - b.index);
    await expect(ids).toHaveText(named.map(c => String(c.index)));
    await sort.selectOption('power');
    const powered = [...characters].sort((a, b) => characterPower(b) - characterPower(a) || a.index - b.index);
    await expect(ids).toHaveText(powered.map(c => String(c.index)));
    await page.locator('.character-table tbody tr').first().click();
    const modal = page.getByRole('dialog', { name: `ID ${powered[0].index}`, exact: true });
    await modal.getByRole('button', { name: '다음 캐릭터', exact: true }).click();
    await page.getByRole('dialog', { name: `ID ${powered[1].index}`, exact: true }).getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    const bounds = await sort.boundingBox(); const toolbar = await page.locator('.character-controls').boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width - (toolbar!.x + toolbar!.width - 10))).toBeLessThan(2);
    await page.getByRole('button', { name: '개요', exact: true }).click();
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await expect(sort).toHaveValue('power');
    await sort.selectOption('default'); await expect(ids).toHaveText(['0', '220', '221', '639']);
  } finally { await browser.close(); }
});


test('web: ranking shows level99 bounds, ranks by maximum, and keeps character filters independent', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1920, height: 1000 } });
  try {
    const data = save(); data[0x59a6] = 0;
    data[0x9a6 + 220 * 32 + 24] = 98;
    data.writeUInt16LE(200, 0x9a6 + 220 * 32 + 26);
    data[0x9a6 + 221 * 32 + 24] = 99;
    data.writeUInt16LE(900, 0x9a6 + 221 * 32 + 26);
    data[0x9a6 + 220 * 32 + 12] = 6;
    data.set([6, 1, 4, 0xff], 0x6e5);
    data[0x9a6 + 220 * 32 + 21] = 0x2d; data[0x9a6 + 220 * 32 + 10] = 99;
    const parsed = parseSave(data);
    const expected = parsed.characters.filter(c => c.index >= 220).map(c => ({ id: c.index,
      ...characterLevel99PowerRange(c, data.subarray(0x9a6 + c.index * 32, 0x9a6 + (c.index + 1) * 32)) })).sort((a, b) => b.max - a.max || a.id - b.id);
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'ranking.dat', mimeType: 'application/octet-stream', buffer: data });
    await page.getByRole('button', { name: '파워랭킹', exact: true }).click();
    const table = page.locator('.ranking-table'); const rows = table.locator('tbody tr');
    await expect(table.locator('th[data-column="POWER"]')).toHaveAttribute('title', '현재 파워');
    await expect(table.locator('th[data-column="Lv99 POWER"]')).toHaveAttribute('title', /아이템·피로도 제외/);
    await expect(table.locator('th[data-column="SKILL"]')).toHaveAttribute('title', '현재 직업의 마법 스킬 사용 가능 여부');
    await expect(rows.first().locator('td[data-column="SKILL"]')).toHaveText('마법');
    const columns = ['RANK', 'ID', 'LEAD', 'NAME', 'CLASS', 'POWER', 'Lv99 POWER', 'LV', 'HP', 'HR', 'AT', 'AR', 'DF', 'DR', 'AD', 'AA', 'MD', 'SKILL'];
    await expect(table.locator('th')).toHaveText(columns);
    await expect(rows.locator('td[data-column="ID"]')).toHaveText(expected.map(c => String(c.id)));
    await expect(rows.locator('td[data-column="RANK"]')).toHaveText(expected.map(character => String(1 + expected.filter(other => other.max > character.max).length)));
    await expect(rows.locator('td[data-column="Lv99 POWER"]')).toHaveText(expected.map(c => `${c.min}~${c.max}`));
    const ares = table.getByRole('row', { name: '아레스 편집', exact: true });
    await expect(ares.locator('td[data-column="SKILL"]')).toHaveText('소환');
    await expect(ares.locator('td[data-column="SKILL"]')).toHaveAttribute('title', /소환 마법 포함/);
    await expect(rows.first().locator('td[data-column="SKILL"]')).toHaveAttribute('title', /소환 마법은 포함되어 있지 않습니다/);
    const forecast = expected.find(c => c.id === 220)!;
    for (const [column, range] of Object.entries(forecast.stats)) {
      await expect(ares.locator(`td[data-column="${column}"]`)).toHaveText(range.min === range.max ? String(range.min) : `${range.min}~${range.max}`);
    }
    const current = parsed.characters.find(c => c.index === 220)!;
    await expect(ares.locator('td[data-column="POWER"]')).toHaveText(String(characterPower({ ...current, item: 0, fatigue: 0 })));
    for (const width of [1600, 1440, 1280, 1279, 1200, 1199, 1100, 1099, 960, 959, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const tabPositions = await page.getByRole('navigation', { name: '에디터 보기' }).getByRole('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
      expect(new Set(tabPositions).size).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const wanted = columns.filter(column =>
        !(width < 1600 && column === 'SKILL') &&
        !(width < 1280 && ['AA', 'AD', 'MD'].includes(column)) &&
        !(width < 1200 && column === 'POWER') &&
        !(width < 1100 && column === 'LV') &&
        !(width < 960 && ['HP', 'HR', 'AT', 'AR', 'DF', 'DR'].includes(column)));
      await expect(table.locator('th:visible')).toHaveText(wanted);
      expect(await rows.first().locator('td:visible').evaluateAll(cells => cells.map(c => c.getAttribute('data-column')))).toEqual(wanted);
    }
    await page.setViewportSize({ width: 1600, height: 1000 });
    const scope = page.getByRole('combobox', { name: '캐릭터 표시 범위', exact: true });
    await scope.selectOption('allied'); await expect(rows).toHaveCount(4);
    await page.getByRole('button', { name: '캐릭터', exact: true }).click(); await expect(scope).toHaveValue('named');
    await scope.selectOption('all');
    await page.getByRole('row', { name: '아레스 편집', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await modal.getByLabel('HP', { exact: true }).fill('999');
    await modal.getByRole('button', { name: '캐릭터 편집 닫기', exact: true }).click();
    await page.getByRole('checkbox', { name: '수정한 캐릭터만 표시', exact: true }).check();
    await page.getByRole('button', { name: '파워랭킹', exact: true }).click();
    await expect(scope).toHaveValue('allied');
    await expect(rows).toHaveCount(4);
    const scores = (await rows.locator('[data-column="Lv99 POWER"]').allTextContents()).map(text => Number(text.split('~')[1]));
    await expect(rows.locator('[data-column="RANK"]')).toHaveText(scores.map(score => String(1 + scores.filter(other => other > score).length)));
    await expect(page.getByRole('checkbox', { name: '수정한 캐릭터만 표시', exact: true })).toHaveCount(0);
    const edited = table.getByRole('row', { name: '아레스 편집', exact: true });
    await expect(edited.locator('[data-column="ID"]')).toHaveText('220*');
    await expect(edited.locator('[data-column="HP"]')).toHaveText('999');
    await expect(edited.locator('[data-column="LV"]')).toHaveText('99');
    await expect(page.getByRole('combobox', { name: '캐릭터 정렬', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: '수정한 캐릭터만 표시', exact: true })).toBeChecked();
    await expect(page.locator('.character-table tbody tr')).toHaveCount(1);
    await expect(scope).toHaveValue('all');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'new-ranking.dat', mimeType: 'application/octet-stream', buffer: save() });
    await page.getByRole('button', { name: '파워랭킹', exact: true }).click(); await expect(scope).toHaveValue('named');
    await page.getByRole('button', { name: '캐릭터', exact: true }).click(); await expect(scope).toHaveValue('named');

  } finally { await browser.close(); }
});

test('web: i18n detects three supported languages, preserves edits, and translates dialogs', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1600, height: 1000 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    const language = page.locator('.language-select select');
    await expect(language).toHaveValue('en');
    await expect(language.locator('option')).toHaveText(['한국어', '日本語', 'English']);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.drop-copy')).toContainText('click to select a file');
    await page.getByLabel('Select save file', { exact: true }).setInputFiles({ name: 'languages.dat', mimeType: 'application/octet-stream', buffer: save() });
    await expect(page.getByRole('navigation', { name: 'Editor views' }).getByRole('button')).toHaveText(['Overview', 'Characters', 'Troops', 'Items', 'Magic', 'Power rankings']);
    await page.getByLabel('Playtime', { exact: true }).fill('42');
    await page.getByLabel('Difficulty', { exact: true }).selectOption('처음');
    await language.selectOption('ja');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    await expect(page.getByLabel('プレイ時間', { exact: true })).toHaveValue('42');
    await expect(page.getByLabel('難易度', { exact: true })).toHaveValue('처음');
    await expect(page.getByRole('navigation', { name: '編集タブ' }).getByRole('button')).toHaveText(['概要', 'キャラクター', '部隊', 'アイテム', '魔法', 'パワーランキング']);
    await page.getByRole('button', { name: 'キャラクター', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'キャラクター表示範囲', exact: true })).toHaveValue('named');
    await page.getByRole('row', { name: 'アレスを編集', exact: true }).click();
    let modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await modal.getByLabel('AT', { exact: true }).fill('77');
    await expect(modal.getByText('基本能力', { exact: true })).toBeVisible();
    await modal.getByRole('button', { name: 'キャラクター編集を閉じる', exact: true }).click();
    await language.selectOption('en');
    await page.getByRole('row', { name: 'Edit 아레스', exact: true }).click();
    modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    await expect(modal.getByLabel('AT', { exact: true })).toHaveValue('77');
    let prompt = '';
    page.once('dialog', async dialog => { prompt = dialog.message(); await dialog.dismiss(); });
    await modal.getByRole('button', { name: 'Reset character', exact: true }).click();
    expect(prompt).toBe('Restore all data for this character to the values originally loaded?');
    await expect(modal.getByLabel('AT', { exact: true })).toHaveValue('77');
    await modal.getByRole('button', { name: 'Close character editor', exact: true }).click();
    for (const name of ['Troops', 'Items', 'Magic', 'Power rankings']) await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.ranking-description')).toHaveText('Ranked by maximum projected POWER at LV 99.');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download save/ }).click();
    const downloadedPath = await (await download).path();
    const data = await readFile(downloadedPath!);
    const parsed = parseSave(data);
    expect(parsed.summary.playMinutes).toBe(42); expect(parsed.summary.difficulty).toBe('처음');
    expect(parsed.characters.find(c => c.index === 220)!.attack).toBe(77);
    expect(parsed.checksums.every(checksum => checksum.valid)).toBe(true);
    await language.selectOption('ko');
    await expect(page.getByRole('button', { name: '개요', exact: true })).toBeVisible();
    await language.selectOption('ja');
    await page.reload(); await expect(page.locator('.language-select select')).toHaveValue('ja');
    await expect(page.locator('.drop-copy')).toContainText('クリックしてファイルを選択してください');
    await page.screenshot({ path: 'test-results/i18n-japanese-loading.png', fullPage: true });
  } finally { await browser.close(); }
});

test('web: unsupported locale falls back to Korean and unavailable storage still allows language switching', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'zh-CN' });
  try {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => { throw new Error('disabled'); };
      Storage.prototype.setItem = () => { throw new Error('disabled'); };
    });
    await page.goto('http://127.0.0.1:5174');
    const language = page.locator('.language-select select');
    await expect(language).toHaveValue('ko');
    await language.selectOption('en'); await expect(language).toHaveValue('en');
    await page.getByLabel('Select save file', { exact: true }).setInputFiles({ name: 'invalid.dat', mimeType: 'application/octet-stream', buffer: Buffer.alloc(3) });
    await expect(page.getByRole('alert')).toContainText('32,768 bytes');
  } finally { await browser.close(); }
});

test('web: text navigation fits translated labels and highlights selected, hovered and focused tabs', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 900 } });
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'tabs.dat', mimeType: 'application/octet-stream', buffer: save() });
    const navigation = page.locator('.editor-header nav'); const buttons = navigation.getByRole('button');
    for (const theme of ['fq4remake', 'light', 'dark', 'dracula']) {
      await page.getByRole('combobox', { name: /테마 선택|Select theme|テーマ選択/ }).selectOption(theme);
      for (const language of ['ko', 'en', 'ja']) {
        await page.locator('.language-select select').selectOption(language);
        for (const width of [1600, 720, 390]) {
          await page.setViewportSize({ width, height: 900 });
          const metrics = await buttons.evaluateAll(items => items.map(button => {
            const rect = button.getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(button);
            const style = getComputedStyle(button);
            return { y: rect.y, width: button.clientWidth, scrollWidth: button.scrollWidth, textWidth: range.getBoundingClientRect().width,
              border: style.borderTopWidth, background: style.backgroundColor };
          }));
          expect(new Set(metrics.map(metric => metric.y)).size).toBe(1);
          for (const metric of metrics) {
            expect(metric.scrollWidth).toBeLessThanOrEqual(metric.width + 1);
            expect(metric.textWidth).toBeLessThanOrEqual(metric.width);
            expect(metric.border).toBe('0px'); expect(metric.background).toBe('rgba(0, 0, 0, 0)');
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        }
      }
    }
    await page.setViewportSize({ width: 1600, height: 900 });
    const selected = navigation.locator('[aria-pressed="true"]');
    await expect(selected).toHaveCSS('text-decoration-line', 'underline');
    const target = buttons.nth(1);
    const normal = await target.evaluate(element => getComputedStyle(element).color);
    await target.hover(); await expect(target).not.toHaveCSS('color', normal);
    await target.focus(); await expect(target).toHaveCSS('text-decoration-style', 'dashed');
    await target.click(); await page.mouse.move(0, 0);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(target).toHaveCSS('text-decoration-line', 'underline');
    await page.screenshot({ path: 'test-results/i18n-text-navigation.png', fullPage: true });
  } finally { await browser.close(); }
});

test('desktop UI: filenames and paths remain verbatim in every language and save notification', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 900 } });
  const folder = 'C:\\게임\\캐릭터 편집';
  const name = '저장 완료 · 파일 편집.dat';
  const backupName = '저장 완료 · 백업 편집.bak';
  await page.addInitScript(({ data, folder, name, backupName }) => {
    const summary = { locationId: 1, location: '카리온성', playMinutes: 10, difficulty: '고투', gold: 0 };
    const result = { kind: 'folder', folder, entries: [{ id: 'file', name, summary }], errors: [] };
    Object.defineProperty(window, 'fq4rDesktop', { value: {
      restoreFolder: async () => result,
      chooseFolder: async () => result,
      loadSave: async () => ({ name, data: new Uint8Array(data), saveId: 'file' }),
      saveFile: async () => ({ backupName }),
      saveFileAs: async () => ({ name, saveId: 'file' })
    } });
  }, { data: Array.from(save()), folder, name, backupName });
  try {
    await page.goto('http://127.0.0.1:5174');
    for (const language of ['ko', 'en', 'ja']) {
      await page.locator('.language-select select').selectOption(language);
      await expect(page.locator('.folder-path')).toHaveText(folder);
      await expect(page.locator('.folder-path')).toHaveAttribute('title', folder);
      await expect(page.locator('.save-filename')).toHaveText(name);
    }
    await page.locator('.save-file-list button').click();
    for (const language of ['ko', 'en', 'ja']) {
      await page.locator('.language-select select').selectOption(language);
      await expect(page.locator('.editor-header h2')).toHaveText(name);
      await page.locator('.editor-save').first().click();
      const prefix = language === 'ko' ? '저장 완료 · 백업: ' : language === 'en' ? 'Saved · Backup: ' : '保存完了・バックアップ: ';
      await expect(page.locator('.save-message')).toHaveText(prefix + backupName);
    }
    await page.locator('.editor-save-as').click();
    await expect(page.locator('.editor-header h2')).toHaveText(name);
    await expect(page.locator('.save-message')).toHaveText('保存完了・' + name);
    await page.locator('.language-select select').selectOption('en');
    await expect(page.locator('.save-message')).toHaveText('Saved · ' + name);
  } finally { await browser.close(); }
});

test('web: Japanese game names update lists and selectors without modifying save bytes', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1920, height: 1000 } });
  const bytes = save(); bytes[0x9a6 + 220 * 32 + 21] = 16;
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'names.dat', mimeType: 'application/octet-stream', buffer: bytes });
    await page.getByRole('button', { name: '캐릭터', exact: true }).click();
    await expect(page.getByRole('row', { name: '아레스 편집', exact: true })).toBeVisible();
    await page.locator('.language-select select').selectOption('ja');
    const row = page.getByRole('row', { name: 'アレスを編集', exact: true });
    await expect(row.locator('[data-column="NAME"]')).toHaveText('アレス');
    await expect(row.locator('[data-column="CLASS"]')).toHaveText('キング');
    await expect(row.locator('[data-column="ITEM"]')).toHaveText('エクスカリバー');
    await expect(row.locator('[data-column="SKILL"]')).toHaveText('サンダー');
    await row.click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    const record = await modal.locator('.record-hex-byte').allTextContents();
    await expect(modal.getByRole('combobox', { name: 'NAME', exact: true })).toHaveValue('26');
    await expect(modal.getByRole('combobox', { name: 'NAME', exact: true }).locator('option[value="26"]')).toHaveText('アレス (26)');
    await expect(modal.getByRole('combobox', { name: 'ITEM', exact: true }).locator('option[value="16"]')).toHaveText('エクスカリバー (16)');
    await expect(modal.getByRole('combobox', { name: 'SKILL/MAGIC', exact: true }).locator('option[value="6"]')).toHaveText('サンダー (6)');
    const picker = modal.getByRole('combobox', { name: 'CLASS', exact: true });
    await picker.click();
    await expect(modal.locator('.class-select-options li').first().locator('span')).toHaveText('キング');
    await picker.press('Escape');
    await expect(modal.locator('.record-hex-byte')).toHaveText(record);
    await modal.getByRole('button', { name: 'キャラクター編集を閉じる', exact: true }).click();
    await page.getByRole('button', { name: 'アイテム', exact: true }).click();
    await expect(page.locator('.inventory-table')).toContainText('エクスカリバー');
    await page.getByRole('button', { name: '+ アイテム追加', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ショートソード', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '魔法', exact: true }).click();
    await expect(page.locator('.magic-list article').first().locator('h3')).toContainText('キング');
    await expect(page.locator('.magic-slot select').first().locator('option[value="6"]')).toHaveText('サンダー');
    await page.locator('.language-select select').selectOption('en');
    await expect(page.locator('.magic-slot select').first().locator('option[value="6"]')).toHaveText('썬더');
    await page.getByRole('button', { name: 'Characters', exact: true }).click();
    await expect(page.getByRole('row', { name: 'Edit 아레스', exact: true })).toBeVisible();
    const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: /Download save/ }).click();
    const path = await (await downloaded).path(); const output = await readFile(path!);
    const expected = bytes.slice(); expected.fill(0, 0x7da6, 0x7dae);
    output.fill(0, 0x7da6, 0x7dae); expect(output).toEqual(expected);
  } finally { await browser.close(); }
});

test('web: Japanese maps and item descriptions update overview, troops and map selectors', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1920, height: 1000 } });
  const bytes = save(); bytes[0x59a6] = 0; bytes.writeUInt16LE(0x100, 0x59a8); bytes.writeUInt16LE(0x14a, 0x9a6 + 220 * 32 + 14);
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'maps.dat', mimeType: 'application/octet-stream', buffer: bytes });
    await expect(page.locator('.overview-list')).toContainText('카리온성');
    await page.locator('.language-select select').selectOption('ja');
    await expect(page.locator('.overview-list')).toContainText('カーリオンの城');
    await page.getByRole('button', { name: 'アイテム', exact: true }).click();
    const item = page.locator('.inventory-table tbody tr').filter({ hasText: 'エクスカリバー' });
    await expect(item.locator('.inventory-desc')).toHaveText('AT+20 AR+10 DF+00 DR+05 使う者を疲労させない');
    await page.getByRole('button', { name: '部隊', exact: true }).click();
    const row = page.getByRole('row', { name: '部隊8を編集', exact: true });
    await expect(row.locator('[data-column="MAP-NAME"]')).toHaveText('リンカーの町');
    await expect(row.locator('[data-column="NATION"]')).toContainText('カーリオン');
    await row.click();
    const troop = page.getByRole('dialog', { name: '部隊編集', exact: true });
    const nation = troop.getByRole('combobox', { name: '国家', exact: true });
    await expect(nation.locator('option[value="0"]')).toHaveText('カーリオン');
    await page.locator('.language-select select').selectOption('ko');
    await expect(page.getByRole('dialog', { name: '부대 편집', exact: true }).getByRole('combobox', { name: '국가', exact: true }).locator('option[value="0"]')).toHaveText('카리온');
    await page.locator('.language-select select').selectOption('ja');
    await expect(nation.locator('option[value="0"]')).toHaveText('カーリオン');
    const map = troop.getByRole('combobox', { name: 'MAP-NAME', exact: true });
    await expect(map).toHaveValue('256');
    await expect(map.locator('option[value="256"]')).toHaveText('リンカーの町 (0x0100)');
    await expect(map.locator('option[value="101"]')).toHaveCount(0);
    await expect(map.locator('option[value="1"]')).toHaveText('カーリオンの城 (0x0001)');
    await troop.getByRole('button', { name: '部隊編集を閉じる', exact: true }).click();
    await page.getByRole('button', { name: 'キャラクター', exact: true }).click();
    await page.getByRole('row', { name: 'アレスを編集', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'ID 220', exact: true });
    const casualty = modal.getByRole('combobox', { name: '死亡・捕虜・行方不明の場所', exact: true });
    await expect(casualty).toHaveValue('330');
    await expect(casualty.locator('option[value="330"]')).toHaveText('カーリオンの城 (0x014A)');
    await modal.getByRole('button', { name: 'キャラクター編集を閉じる', exact: true }).click();
    await page.locator('.language-select select').selectOption('ko');
    await page.getByRole('button', { name: '아이템', exact: true }).click();
    await expect(page.locator('td.inventory-desc').first()).toContainText('쉽게 지치지 않도록 함');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: /세이브 파일 다운로드/ }).click();
    const path = await (await download).path(); const output = await readFile(path!);
    const expected = bytes.slice(); expected.fill(0, 0x7da6, 0x7dae); output.fill(0, 0x7da6, 0x7dae);
    expect(output).toEqual(expected);
  } finally { await browser.close(); }
});

test('desktop UI: folder map labels follow Japanese selection using stable location IDs', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ja-JP' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'fq4rDesktop', { value: { restoreFolder: async () => ({ kind: 'folder', folder: 'C:\\Games\\FQ4R',
      entries: [{ id: 'save', name: 'save00.dat', summary: { locationId: 10, location: '켄트마을', playMinutes: 20, difficulty: '보통', gold: 0 } }], errors: [] }) } });
  });
  try {
    await page.goto('http://127.0.0.1:5174');
    await expect(page.locator('.save-location')).toHaveText('ケントの町');
    await page.locator('.language-select select').selectOption('ko');
    await expect(page.locator('.save-location')).toHaveText('켄트마을');
    await expect(page.locator('.save-summary-changed')).toHaveCount(0);
  } finally { await browser.close(); }
});

test('desktop UI: localized save difficulty columns fit without wrapping or overlap', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR' });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'fq4rDesktop', { value: { restoreFolder: async () => ({ kind: 'folder', folder: 'C:/Games/FQ4R',
      entries: ['처음', '초보', '보통', '능숙', '고투'].map((difficulty, i) => ({ id: String(i), name: `save0${i}.dat`, summary: { locationId: 10, location: '켄트마을', playMinutes: 313, difficulty, gold: 0 } })), errors: [] }) } });
  });
  try {
    await page.goto('http://127.0.0.1:5174');
    for (const language of ['ko', 'ja', 'en']) {
      await page.locator('.language-select select').selectOption(language);
      for (const width of [1280, 720, 640, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        const cells = await page.locator('.save-file-list button').evaluateAll(rows => rows.map(row => Array.from(row.children).map(cell => {
          const rect = cell.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, fits: cell.scrollWidth <= cell.clientWidth, nowrap: getComputedStyle(cell).whiteSpace === 'nowrap' };
        })));
        expect(cells).toHaveLength(5);
        for (const row of cells) {
          expect(row.slice(1).every(cell => cell.fits && cell.nowrap)).toBe(true);
          for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
            const a = row[i], b = row[j];
            expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true);
          }
        }
      }
    }
  } finally { await browser.close(); }
});

test('web: ranking ties use maximum level99 POWER and competition ranks within each scope', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 1600, height: 1000 } });
  const data = save(); data[0x59a6] = 0;
  for (const [id, hp] of [[0, 0], [220, 794], [221, 800], [639, 600]]) {
    const offset = 0x9a6 + id * 32; data[offset + 24] = id === 220 ? 98 : 99; data.writeUInt16LE(hp, offset + 26);
  }
  data[0x9a6 + 221 * 32 + 29] = 1;
  try {
    await page.goto('http://127.0.0.1:5174');
    await page.getByLabel('세이브 파일 선택', { exact: true }).setInputFiles({ name: 'ties.dat', mimeType: 'application/octet-stream', buffer: data });
    await page.getByRole('button', { name: '파워랭킹', exact: true }).click();
    const scope = page.getByRole('combobox', { name: '캐릭터 표시 범위', exact: true });
    await scope.selectOption('allied');
    const rows = page.locator('.ranking-table tbody tr');
    await expect(rows.locator('[data-column="ID"]')).toHaveText(['220', '221', '639', '0']);
    await expect(rows.locator('[data-column="RANK"]')).toHaveText(['1', '1', '3', '4']);
    const ranges = await rows.locator('[data-column="Lv99 POWER"]').allTextContents();
    expect(ranges[0].split('~')[1]).toBe(ranges[1].split('~')[1]); expect(ranges[0]).not.toBe(ranges[1]);
    await scope.selectOption('named');
    const named = await rows.locator('[data-column="ID"]').allTextContents();
    const tiedRanks = await rows.locator('[data-column="RANK"]').allTextContents();
    expect(tiedRanks[named.indexOf('220')]).toBe(tiedRanks[named.indexOf('221')]);
  } finally { await browser.close(); }
});
