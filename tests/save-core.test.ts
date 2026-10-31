import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseSave, appendTroopMember, swapTroopMembers, replaceTroopMember, characterPower, applyTroopMacro, troopNationSuffix, troopAffiliationLabel, compareTroops, troopCountryName, troopCountryColor, readTroopRecords, editTroop, prepareSave, stepCharacterLevel, growCharacterTo99, syncCharacterPromotion, itemQualityScore, editCharacter, itemDescription, ITEM_OPTIONS, editInventory, editMagicLists, troopLocationName, troopNationLabel, troopPower, validateSave, inspectChecksums, repairChecksumBlock, editOverview, difficultyName, locationName, characterName, className, CHECKSUM_OFFSET, MAX_PLAY_MINUTES, MAX_GOLD, DIFFICULTIES } from '../packages/save-core/src/index.ts';
import { SaveFiles } from '../apps/desktop/src/save-files.ts';

function fixture(flags = 0x58): Uint8Array {
  const bytes = new Uint8Array(0x8000);
  bytes.set([0x77, 0x69, 0x6e, 0x34]);
  const view = new DataView(bytes.buffer);
  view.setUint32(0x200, 30, true); view.setUint16(0x204, 1, true); view.setUint16(0x20c, flags, true);
  view.setUint32(0x692, 999999, true);
  bytes[0x6de] = 0xff; bytes[0x59a6] = 0xff;
  for (let i = 0; i < bytes.length; i++) {
    if (i < CHECKSUM_OFFSET || i >= CHECKSUM_OFFSET + 8) bytes[CHECKSUM_OFFSET + (i >>> 12)] ^= bytes[i];
  }
  return bytes;
}

test('loader validation, summary offsets, and input immutability', () => {
  const bytes = fixture(); const before = bytes.slice();
  const save = parseSave(bytes);
  assert.deepEqual(save.summary, { locationId: 1, location: '카리온성', playMinutes: 30, difficulty: '고투', gold: 999999 });
  assert.equal(save.characters.length, 529); assert.equal(save.checksums.length, 8);
  assert.deepEqual(bytes, before);
  assert.throws(() => validateSave(bytes.subarray(1)), /크기/);
  const bad = bytes.slice(); bad[1] = 0x49;
  assert.throws(() => validateSave(bad), /signature/);
});

test('every block rejects corruption, including data after checksum storage', () => {
  for (let block = 0; block < 8; block++) {
    const data = fixture(); data[block * 0x1000 + 0x300] ^= 1;
    assert.throws(() => validateSave(data), new RegExp(`영역: ${block}`));
    const parsed = parseSave(data);
    assert.equal(parsed.checksums[block].valid, false);
    assert.deepEqual(parsed.warnings, []);
  }
  const data = fixture(); data[0x7fff] ^= 1;
  assert.throws(() => validateSave(data), /영역: 7/);
});

test('packed difficulty uses only the documented bits; internal locations retain names', () => {
  for (const [value, label] of [[0, '처음'], [8, '초보'], [16, '보통'], [24, '능숙'], [88, '고투']] as const) {
    assert.equal(difficultyName(value | 0xc001), label);
  }
  assert.equal(locationName(0x1f3), '오프닝-제넬루 아레스');
  assert.match(locationName(65535), /알 수 없는/);
});

test('character names use the full name ID and leave zero IDs unnamed', () => {
  assert.equal(characterName(0x1a), '아레스');
  assert.equal(characterName(0x209), '애레인');
  assert.equal(characterName(1), '아이오로스');
  assert.equal(characterName(0), '(이름없음)');
  assert.equal(className(0), '킹');
  assert.match(characterName(65535), /이름 미확인.*FFFF/);
  assert.match(className(220), /직업 미확인.*DC/);
});

test('only zero-filled dynamic slots are hidden, preserving fixed slots and original indices', () => {
  const source = fixture();
  source[0x9a6 + 529 * 32 + 22] = 1;
  source[0x9a6 + 639 * 32 + 2] = 1;
  const before = source.slice();
  const parsed = parseSave(source);
  assert.equal(parsed.characters.length, 531);
  assert.ok(parsed.characters.some(character => character.index === 528));
  assert.ok(parsed.characters.some(character => character.index === 529 && character.nameId === 0));
  assert.ok(parsed.characters.some(character => character.index === 639));
  assert.ok(!parsed.characters.some(character => character.index === 530));
  assert.deepEqual(source, before);
});

test('character table fields are read from their documented record offsets', () => {
  const bytes = fixture();
  const p = 0x9a6 + 220 * 32;
  for (const [offset, value] of [[7, 15], [8, 0x50], [10, 9], [16, 12], [17, 5], [18, 7], [21, 0x10], [23, 6], [25, 0]]) bytes[p + offset] = value;
  const character = parseSave(bytes).characters.find(character => character.index === 220)!;
  assert.equal(character.lead, 15);
  assert.equal(character.elementFlags, 0x50);
  assert.equal(character.fatigue, 9);
  assert.equal(character.projectileAttack, 12);
  assert.equal(character.projectileDefensePenalty, 5);
  assert.equal(character.magicDefensePenalty, 7);
  assert.equal(character.item, 0x10);
  assert.equal(character.skill, 6);
  assert.equal(character.recoveryRaw, 0);
});

test('overview edits enforce bounds, preserve unknown bits and stored checksums, and never mutate input', () => {
  const source = fixture(0xd259);
  const original = source.slice();
  for (const difficulty of DIFFICULTIES) {
    const changed = editOverview(source, { playMinutes: MAX_PLAY_MINUTES, gold: MAX_GOLD, difficulty });
    const view = new DataView(changed.buffer);
    assert.equal(view.getUint32(0x200, true), MAX_PLAY_MINUTES);
    assert.equal(view.getUint32(0x692, true), MAX_GOLD);
    assert.equal(difficultyName(view.getUint16(0x20c, true)), difficulty);
    assert.equal(view.getUint16(0x20c, true) & ~0x58, 0xd259 & ~0x58);
    assert.deepEqual(changed.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + 8), original.slice(CHECKSUM_OFFSET, CHECKSUM_OFFSET + 8));
    const allowed = new Set([0x200, 0x201, 0x202, 0x203, 0x20c, 0x20d, 0x692, 0x693, 0x694, 0x695]);
    for (let i = 0; i < source.length; i++) if (!allowed.has(i)) assert.equal(changed[i], original[i]);
  }
  const changed = editOverview(source, { gold: 1 });
  assert.equal(inspectChecksums(changed).filter(checksum => !checksum.valid).length, 1);
  const restored = editOverview(changed, { gold: 999999 });
  assert.ok(inspectChecksums(restored).every(checksum => checksum.valid));
  for (const value of [-1, 0.5, NaN, Infinity]) {
    assert.throws(() => editOverview(source, { gold: value }), RangeError);
    assert.throws(() => editOverview(source, { playMinutes: value }), RangeError);
  }
  assert.throws(() => editOverview(source, { gold: MAX_GOLD + 1 }), RangeError);
  assert.throws(() => editOverview(source, { playMinutes: MAX_PLAY_MINUTES + 1 }), RangeError);
  assert.deepEqual(source, original);
});

test('folder filtering, invalid-file isolation, remembered folder, and selection revalidation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fq4r-editor-'));
  const game = join(directory, '게임');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(game);
  try {
    await writeFile(join(game, 'save00.dat'), fixture());
    await writeFile(join(game, 'SAVE01.DAT'), fixture(0));
    await writeFile(join(game, 'save02.dat'), new Uint8Array(30));
    await writeFile(join(game, 'saveAB.dat'), fixture());
    const settings = join(directory, 'settings');
    const service = new SaveFiles(settings);
    const result = await service.scanFolder(game);
    assert.equal(result.kind, 'folder');
    if (result.kind !== 'folder') return;
    assert.equal(result.entries.length, 2); assert.equal(result.errors.length, 1);
    assert.equal(result.entries[0].name, 'save00.dat');
    const loaded = await service.loadSave(result.entries[0].id);
    assert.equal(loaded.data.length, 32768);
    const remembered = await new SaveFiles(settings).restoreFolder();
    assert.equal(remembered?.kind, 'folder');
    assert.equal(JSON.parse(await readFile(join(settings, 'settings.json'), 'utf8')).gameFolder, resolve(game));
    const corrupt = fixture(); corrupt[0x692] ^= 1;
    await writeFile(join(game, 'save00.dat'), corrupt);
    const modified = await service.loadSave(result.entries[0].id);
    assert.equal(parseSave(modified.data).checksums[0].valid, false);
    const rescanned = await service.scanFolder(game);
    assert.equal(rescanned.kind, 'folder');
    if (rescanned.kind !== 'folder') return;
    assert.equal(rescanned.entries.length, 2);
    assert.equal(rescanned.errors.length, 1);
    await writeFile(join(game, 'save00.dat'), new Uint8Array(12));
    await assert.rejects(() => service.loadSave(rescanned.entries[0].id), /크기/);
    await writeFile(join(game, 'save00.dat'), corrupt);
    await assert.rejects(() => service.loadSave('not-an-issued-token'), /찾을 수/);
    assert.deepEqual(new Uint8Array(await readFile(join(game, 'save00.dat'))), corrupt);
    assert.equal((await new SaveFiles(join(directory, 'absent')).restoreFolder()), null);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + (await import('node:path')).sep));
    await rm(directory, { recursive: true, force: true });
  }
});


test('explicit checksum repair updates only the chosen byte using current edited data', () => {
  for (let block = 0; block < 8; block++) {
    const source = fixture(); source[block * 0x1000 + 0x300] ^= 0x5a;
    const edited = editOverview(source, { gold: 2 });
    const before = edited.slice();
    const expected = inspectChecksums(edited)[block].expected;
    const result = repairChecksumBlock(edited, block);
    assert.deepEqual(edited, before);
    assert.equal(result.checksum.stored, expected);
    assert.equal(result.checksum.expected, expected);
    assert.equal(result.checksum.valid, true);
    assert.equal(inspectChecksums(result.data)[block].valid, true);
    for (let i = 0; i < before.length; i++) {
      if (i !== CHECKSUM_OFFSET + block) assert.equal(result.data[i], before[i]);
    }
  }
  assert.throws(() => repairChecksumBlock(fixture(), -1), RangeError);
  assert.throws(() => repairChecksumBlock(fixture(), 8), RangeError);
});


test('troop fields and member references preserve header values, order, and duplicates', () => {
  const bytes = fixture();
  const view = new DataView(bytes.buffer);
  bytes[0x59a6] = 0x31; bytes[0x59a7] = 3; bytes[0x59ac] = 7;
  view.setUint16(0x59a8, 0x201, true);
  [220, 639, 220].forEach((slot, i) => view.setUint16(0x59b6 + i * 2, slot * 32, true));
  bytes[0x59bc] = 0xff;
  assert.deepEqual(parseSave(bytes).troops, [{ index: 0, state: 0x31, nationGroup: 0, id: 7, mapId: 0x201, memberCount: 3, members: [220, 639, 220] }]);
});

test('troop POWER follows HP rounding, fatigue, equipment, class flags, duplicates, and cap', () => {
  const base = { ...parseSave(fixture()).characters[220], hp: 101, attack: 40, hit: 50, defense: 30, evasion: 20 };
  const troop = { index: 0, state: 0, nationGroup: 0, id: 0, mapId: 1, memberCount: 1, members: [220] };
  const power = (changes: Partial<typeof base> = {}) => troopPower(troop, new Map([[220, { ...base, ...changes }]]));
  assert.equal(power(), 572); // (floor(101/2) + 140 + 16*6) * 2
  assert.equal(power({ classId: 1 }), 852); // Class flags double the four-stat sum.
  assert.equal(power({ fatigue: 4 }), 552); // AT/AR -1; DF/DR -4.
  assert.equal(power({ item: 0x10 }), 642); // Excalibur adds 35 to the stat sum.
  assert.equal(power({ item: 0x2d, recoveryRaw: 3 }), 496); // HR 3+5; DF/DR +5 each.
  assert.equal(power({ item: 0x2d, recoveryRaw: 14 }), 592); // HR capped at 16.
  assert.equal(power({ classId: 0x8a }), 972); // Costume bonuses then class doubling.
  const duplicate = { ...troop, state: 1, mapId: 0x201, memberCount: 2, members: [220, 220] };
  assert.equal(troopPower(duplicate, new Map([[220, base]])), 1168);
  assert.equal(troopPower({ ...troop, memberCount: 2, members: [220, 220] }, new Map([[220, { ...base, hp: 65535 }]])), 99999);
  assert.equal(troopPower(troop, new Map()), null);
  assert.equal(troopPower({ ...troop, memberCount: 0, members: [] }, new Map()), 0);
});


test('spell edits compact empty slots, shift records safely, and preserve checksums and unrelated bytes', () => {
  const bytes = fixture();
  bytes.set([0, 2, 6, 7, 1, 1, 15, 0xff], 0x6de);
  bytes[0x7f5] = 0xab;
  const before = bytes.slice();
  const changed = editMagicLists(bytes, [{ classId: 0, spells: [0, 7, 8, 0, 0] }, { classId: 1, spells: [15] }]);
  assert.deepEqual(parseSave(changed).magic, [{ classId: 0, spells: [7, 8] }, { classId: 1, spells: [15] }]);
  const deleted = editMagicLists(changed, [{ classId: 0, spells: [0, 0, 0, 0, 0] }, { classId: 1, spells: [15] }]);
  assert.deepEqual(parseSave(deleted).magic, [{ classId: 0, spells: [] }, { classId: 1, spells: [15] }]);
  assert.deepEqual(deleted.subarray(0, 0x6de), before.subarray(0, 0x6de));
  assert.deepEqual(deleted.subarray(0x6e6), before.subarray(0x6e6));
  assert.deepEqual(bytes, before);
  assert.throws(() => editMagicLists(bytes, Array.from({ length: 50 }, (_, classId) => ({ classId, spells: [1, 2, 3, 4, 5] }))), /저장 공간/);
  assert.throws(() => editMagicLists(bytes, [{ classId: 0, spells: [1, 2, 3, 4, 5, 6] }]), /최대 5개/);
  assert.throws(() => editMagicLists(bytes, [{ classId: 0, spells: [255] }]), /ID/);
  const malformed = bytes.slice(); malformed.fill(0, 0x6de, 0x7f6);
  assert.throws(() => editMagicLists(malformed, []), /구조|끝 표시/);
});


test('troop display categories use exact raw states rather than masking nation bits', () => {
  assert.equal(troopNationLabel(0x00), '카리온');
  assert.equal(troopNationLabel(0x01), '바르시아');
  assert.equal(troopNationLabel(0xd1), '양산형');
  for (const state of [0x03, 0x04, 0x05, 0x30, 0x31, 0x34, 0x35]) assert.equal(troopNationLabel(state), '중립국');
});


test('troop map labels preserve interior IDs and ignore unsupported upper bytes', () => {
  assert.equal(troopLocationName(0x0001), '카리온성');
  assert.equal(troopLocationName(0x01f3), '오프닝-제넬루 아레스');
  assert.equal(troopLocationName(0x0201), '카리온성');
  assert.equal(troopLocationName(0xff01), '카리온성');
  assert.equal(troopLocationName(0x0101), locationName(0x0101));
  const bytes = fixture();
  bytes[0x59a6] = 1; bytes[0x59a7] = 0; bytes[0x59a8] = 1; bytes[0x59a9] = 0xff; bytes[0x59b6] = 0xff;
  assert.equal(parseSave(bytes).troops[0].mapId, 0xff01);
});


test('all interior map labels are present with DOS detail or explicit FQ4R fallbacks', () => {
  assert.equal(locationName(0x100), '링커-촌장');
  assert.equal(locationName(0x14a), '카리온-회의실');
  assert.equal(locationName(0x154), '바르시아-대전');
  assert.match(locationName(0x1fe), /내부 0x01FE/);
  for (let id = 0x100; id < 0x200; id++) assert.doesNotMatch(locationName(id), /알 수 없는 지역/);
  assert.equal(troopLocationName(0x0100), '링커-촌장');
  assert.equal(troopLocationName(0x0201), '카리온성');
});


test('inventory swaps full pairs in sparse slots and edits quantities without changing checksums', () => {
  const bytes = fixture();
  bytes.set([16, 1], 0x492); bytes.set([3, 2], 0x498);
  bytes[0x495] = 0x79;
  const before = bytes.slice();
  const swapped = editInventory(bytes, { type: 'swap', from: 0, to: 3 });
  assert.deepEqual(swapped.inventory, [{ slot: 0, id: 3, quantity: 2 }, { slot: 3, id: 16, quantity: 1 }]);
  assert.equal(swapped.data[0x495], 0x79);
  const edited = editInventory(swapped.data, { type: 'quantity', slot: 3, quantity: 99 });
  assert.deepEqual(edited.inventory[1], { slot: 3, id: 16, quantity: 99 });
  for (let i = 0; i < bytes.length; i++) if (![0x492, 0x493, 0x498, 0x499].includes(i)) assert.equal(edited.data[i], before[i]);
  assert.deepEqual(bytes, before);
  assert.deepEqual(editInventory(bytes, { type: 'swap', from: 0, to: 0 }).data, before);
  assert.equal(editInventory(bytes, { type: 'quantity', slot: 0, quantity: 0 }).inventory[0].id, 16);
  for (const quantity of [-1, 100, 1.5, NaN]) assert.throws(() => editInventory(bytes, { type: 'quantity', slot: 0, quantity }), /수량/);
  assert.throws(() => editInventory(bytes, { type: 'swap', from: 0, to: 256 }), /슬롯/);
});


test('deleting an inventory item compacts remaining pairs in order and clears unused slots', () => {
  const bytes = fixture(); bytes.set([16, 99], 0x492); bytes.set([3, 2], 0x498); bytes.set([2, 0], 0x690);
  const original = bytes.slice();
  for (const slot of [0, 3, 255]) {
    const result = editInventory(bytes, { type: 'delete', slot });
    const expected = [{ slot: 0, id: 16, quantity: 99 }, { slot: 3, id: 3, quantity: 2 }, { slot: 255, id: 2, quantity: 0 }]
      .filter(item => item.slot !== slot).map((item, index) => ({ ...item, slot: index }));
    assert.deepEqual(result.inventory, expected);
    assert.deepEqual(Array.from(result.data.subarray(0x492, 0x496)), expected.flatMap(item => [item.id, item.quantity]));
    assert.ok(result.data.subarray(0x496, 0x692).every(byte => byte === 0));
    assert.deepEqual(result.data.subarray(0, 0x492), original.subarray(0, 0x492));
    assert.deepEqual(result.data.subarray(0x692), original.subarray(0x692));
    assert.deepEqual(parseSave(prepareSave(result.data)).inventory, expected);
    assert.deepEqual(bytes, original);
  }
  let data = bytes;
  for (let i = 0; i < 3; i++) data = editInventory(data, { type: 'delete', slot: 0 }).data;
  assert.deepEqual(parseSave(data).inventory, []);
});


test('inventory additions append with quantity one, handle full tails, and reject a full inventory', () => {
  const bytes = fixture(); bytes.set([16, 99], 0x492); bytes.set([3, 2], 0x498);
  const original = bytes.slice();
  const added = editInventory(bytes, { type: 'add', itemId: 1 });
  assert.deepEqual(added.inventory, [{ slot: 0, id: 16, quantity: 99 }, { slot: 3, id: 3, quantity: 2 }, { slot: 4, id: 1, quantity: 1 }]);
  for (let i = 0; i < bytes.length; i++) if (![0x49a, 0x49b].includes(i)) assert.equal(added.data[i], original[i]);
  assert.deepEqual(bytes, original);
  assert.deepEqual(editInventory(fixture(), { type: 'add', itemId: 1 }).inventory, [{ slot: 0, id: 1, quantity: 1 }]);
  const full = fixture();
  for (let i = 0; i < 256; i++) full.set([1, 2], 0x492 + i * 2);
  assert.throws(() => editInventory(full, { type: 'add', itemId: 2 }), /가득/);
  full[0x492 + 10 * 2] = 0;
  assert.equal(editInventory(full, { type: 'add', itemId: 3 }).inventory[10].id, 3);
  assert.throws(() => editInventory(bytes, { type: 'add', itemId: 0 }), /ID/);
  assert.throws(() => editInventory(bytes, { type: 'add', itemId: 16 }), /이미 등록/);
  const zeroQuantity = bytes.slice(); zeroQuantity[0x493] = 0;
  assert.throws(() => editInventory(zeroQuantity, { type: 'add', itemId: 16 }), /이미 등록/);
  assert.deepEqual(bytes, original);
  const removed = editInventory(bytes, { type: 'delete', slot: 0 });
  assert.equal(editInventory(removed.data, { type: 'add', itemId: 16 }).inventory.filter(item => item.id === 16).length, 1);
});


test('global inventory quantities preserve holes and a reset restores the original 512 bytes only', () => {
  const original = fixture(); original.set([16, 2], 0x492); original.set([3, 5], 0x498); original[0x495] = 0x79;
  const snapshot = original.slice(0x492, 0x692);
  const bulk = editInventory(original, { type: 'quantities', values: [{ slot: 0, quantity: 99 }, { slot: 3, quantity: 99 }] });
  assert.deepEqual(bulk.inventory.map(item => item.quantity), [99, 99]);
  assert.equal(bulk.data[0x495], 0x79);
  const added = editInventory(bulk.data, { type: 'add', itemId: 1 });
  added.data[0x692] = 123;
  const restored = editInventory(added.data, { type: 'restore', region: snapshot });
  assert.deepEqual(restored.data.subarray(0x492, 0x692), snapshot);
  assert.deepEqual(restored.data.subarray(0, 0x492), added.data.subarray(0, 0x492));
  assert.deepEqual(restored.data.subarray(0x692), added.data.subarray(0x692));
  assert.deepEqual(restored.inventory, [{ slot: 0, id: 16, quantity: 2 }, { slot: 3, id: 3, quantity: 5 }]);
  assert.throws(() => editInventory(original, { type: 'restore', region: new Uint8Array(511) }), /크기/);
  assert.throws(() => editInventory(original, { type: 'quantities', values: [{ slot: 0, quantity: 100 }] }), /수량/);
});


test('acquire-all replaces every slot with the full sorted catalog and clears the unused tail', () => {
  const bytes = fixture();
  for (let slot = 0; slot < 256; slot++) bytes.set([16, 5], 0x492 + slot * 2);
  const before = bytes.slice();
  const result = editInventory(bytes, { type: 'acquire-all' });
  assert.deepEqual(result.inventory, ITEM_OPTIONS.map((item, slot) => ({ slot, id: item.id, quantity: 99 })));
  assert.ok(result.data.subarray(0x492 + ITEM_OPTIONS.length * 2, 0x692).every(byte => byte === 0));
  assert.deepEqual(editInventory(result.data, { type: 'acquire-all' }).data, result.data);
  assert.deepEqual(result.data.subarray(0, 0x492), before.subarray(0, 0x492));
  assert.deepEqual(result.data.subarray(0x692), before.subarray(0x692));
  assert.deepEqual(bytes, before);
});


test('identification edits are type-wide and never touch item 48 or the following spell region', () => {
  const bytes = fixture(); bytes.set([16, 1, 16, 2], 0x492);
  const original = bytes.slice();
  assert.equal(parseSave(bytes).itemIdentifications[16], 0);
  const identified = editInventory(bytes, { type: 'identify', itemId: 16, identified: true });
  assert.equal(identified.data[0x6a6], 1);
  assert.equal(identified.inventory.filter(item => item.id === 16).length, 2);
  assert.equal(identified.itemIdentifications[16], 1);
  const all = editInventory(bytes, { type: 'identify-all' });
  assert.ok(all.data.subarray(0x696, 0x6de).every(value => value === 1));
  assert.deepEqual(all.data.subarray(0, 0x696), original.subarray(0, 0x696));
  assert.deepEqual(all.data.subarray(0x6de), original.subarray(0x6de));
  assert.throws(() => editInventory(bytes, { type: 'identify', itemId: 0x48, identified: true }), /저장되지/);
  const cleared = editInventory(all.data, { type: 'identify', itemId: 16, identified: false });
  assert.equal(cleared.itemIdentifications[16], 0);
  const restored = editInventory(all.data, { type: 'restore', region: bytes.slice(0x492, 0x692), identification: bytes.slice(0x696, 0x6de) });
  assert.deepEqual(restored.data, original);
  assert.deepEqual(bytes, original);
});


test('item description formats signed modifiers, includes zero peers, and omits all-zero stats', () => {
  assert.equal(itemDescription(1), 'AT+02 AR+02 DF+00 DR+00 짧은 검');
  assert.equal(itemDescription(16), 'AT+20 AR+10 DF+00 DR+05 쉽게 지치지 않도록 함');
  assert.match(itemDescription(21), /^AT\+20 AR\+00 DF-05 DR-05 /);
  assert.doesNotMatch(itemDescription(0x35), /AT[+-]|AR[+-]|DF[+-]|DR[+-]/);
  assert.ok(itemDescription(0x35).length > 0);
  assert.equal(itemDescription(0), '');
  assert.equal(itemDescription(255), '');
});


test('character edits replace all 32 record bytes only and reuse the checksum snapshot', () => {
  const bytes = fixture();
  const snapshot = parseSave(bytes).checksums;
  const before = bytes.slice();
  const record = Uint8Array.from({ length: 32 }, (_, offset) => offset + 1);
  const changed = editCharacter(bytes, 220, record);
  const position = 0x9a6 + 220 * 32;
  assert.deepEqual(changed.subarray(position, position + 32), record);
  assert.deepEqual(changed.subarray(0, position), before.subarray(0, position));
  assert.deepEqual(changed.subarray(position + 32), before.subarray(position + 32));
  assert.deepEqual(bytes, before);
  assert.equal(parseSave(changed, snapshot).checksums, snapshot);
  assert.throws(() => editCharacter(bytes, 640, record), /레코드/);
  assert.throws(() => editCharacter(bytes, 0, record.subarray(1)), /레코드/);
});


test('prepareSave repairs every checksum, including all edits in the final block', () => {
  const bytes = fixture(); for (let block = 0; block < 8; block++) bytes[block * 0x1000 + 0x300] ^= 0x5a;
  bytes[0x7fff] = 123;
  const before = bytes.slice(); const output = prepareSave(bytes);
  assert.ok(validateSave(output).every(checksum => checksum.valid));
  for (let i = 0; i < bytes.length; i++) if (i < CHECKSUM_OFFSET || i >= CHECKSUM_OFFSET + 8) assert.equal(output[i], before[i]);
  assert.deepEqual(bytes, before);
});

test('desktop save backs up current bytes and replaces only issued paths with valid checksums', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fq4r-write-'));
  try {
    const path = join(directory, 'save00.dat');
    const original = fixture(); await writeFile(path, original);
    const service = new SaveFiles(join(directory, 'settings'));
    const opened = await service.openPath(path);
    if (opened.kind !== 'file' || !opened.saveId) throw new Error('Missing save token');
    const edited = editOverview(original, { gold: 123 });
    assert.equal((await service.saveFile(opened.saveId, edited)).backupName, 'save00.bak');
    assert.deepEqual(new Uint8Array(await readFile(join(directory, 'save00.bak'))), original);
    const saved = new Uint8Array(await readFile(path));
    assert.equal(parseSave(saved).summary.gold, 123); validateSave(saved);
    await service.saveFile(opened.saveId, editOverview(saved, { gold: 456 }));
    assert.deepEqual(new Uint8Array(await readFile(join(directory, 'save00.bak'))), saved);
    await assert.rejects(() => service.saveFile('unknown-token', edited), /찾을 수/);
    await assert.rejects(() => service.saveFile(opened.saveId!, new Uint8Array(1)), /크기/);
    assert.equal(parseSave(new Uint8Array(await readFile(path))).summary.gold, 456);
    const exportPath = join(directory, 'custom.dat');
    const exported = await service.saveFileAs(opened.saveId, exportPath, edited);
    assert.equal(exported.name, 'custom.dat');
    const exportedBytes = new Uint8Array(await readFile(exportPath));
    assert.ok(inspectChecksums(exportedBytes).every(block => block.valid));
    assert.equal(parseSave(exportedBytes).summary.gold, 123);
    assert.equal(parseSave(new Uint8Array(await readFile(path))).summary.gold, 456);
    await service.saveFile(exported.saveId, editOverview(exportedBytes, { gold: 789 }));
    assert.equal(parseSave(new Uint8Array(await readFile(exportPath))).summary.gold, 789);
    assert.deepEqual(new Uint8Array(await readFile(join(directory, 'custom.bak'))), exportedBytes);

    assert.ok(!(await (await import('node:fs/promises')).readdir(directory)).some(name => name.endsWith('.tmp')));
    const secondPath = join(directory, 'save01.dat'); await writeFile(secondPath, original);
    const second = await service.openPath(secondPath);
    await (await import('node:fs/promises')).mkdir(join(directory, 'save01.bak'));
    if (second.kind !== 'file') throw new Error('Expected file');
    await assert.rejects(() => service.saveFile(second.saveId!, edited));
    assert.deepEqual(new Uint8Array(await readFile(secondPath)), original);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + (await import('node:path')).sep));
    await rm(directory, { recursive: true, force: true });
  }
});


test('level growth follows the old-level stat cycle and HP roll, preserving other bytes', () => {
  for (const [level, offset] of [[10, 29], [11, 31], [12, 28], [13, 30]]) {
    const record = new Uint8Array(32).fill(7); record[24] = level;
    record[26] = 100; record[27] = 0;
    const next = stepCharacterLevel(record, 1, () => 0.999999);
    assert.equal(next[24], level + 1); assert.equal(next[offset], 8);
    assert.equal(next[26] | next[27] << 8, 106);
    for (let i = 0; i < 32; i++) if (![24, offset, 26, 27].includes(i)) assert.equal(next[i], record[i]);
    assert.equal(record[offset], 7);
  }
});

test('16-level bonuses select AA, AD, MD or HR exactly once without rerolling capped choices', () => {
  for (let bonus = 0; bonus < 4; bonus++) {
    const record = new Uint8Array(32); record[24] = 16; record[16] = 14; record[17] = 5; record[18] = 6; record[25] = 15;
    const rolls = [bonus / 4, 0]; let calls = 0;
    const next = stepCharacterLevel(record, 1, () => rolls[calls++]);
    assert.equal(calls, 2);
    assert.deepEqual(Array.from(next.slice(16, 19)), [14 + Number(bonus === 0), 5 - Number(bonus === 1), 6 - Number(bonus === 2)]);
    assert.equal(next[25], bonus === 3 ? 0 : 15);
    const cap = record.slice(); cap[16] = 15; cap[17] = cap[18] = cap[25] = 0;
    const capped = stepCharacterLevel(cap, 1, () => bonus / 4);
    assert.equal(capped[16], 15); assert.equal(capped[17], 0); assert.equal(capped[18], 0); assert.equal(capped[25], 0);
  }
});

test('level down uses the lower level cycle and reverses bonus directions with floors', () => {
  for (let bonus = 0; bonus < 4; bonus++) {
    const record = new Uint8Array(32); record[24] = 17; record[16] = 10; record[17] = record[18] = 5; record[25] = 0; record[28] = 40; record[26] = 100;
    const down = stepCharacterLevel(record, -1, () => bonus / 4);
    assert.equal(down[24], 16); assert.equal(down[28], 39);
    assert.equal(down[16], bonus === 0 ? 9 : 10);
    assert.equal(down[17], bonus === 1 ? 6 : 5); assert.equal(down[18], bonus === 2 ? 6 : 5);
    assert.equal(down[25], bonus === 3 ? 15 : 0);
    assert.equal(down[26], 100 - 4 - Math.floor(bonus / 4 * 3));
  }
  const record = new Uint8Array(32); record[24] = 1; record[17] = record[18] = 30; record[25] = 1;
  const next = stepCharacterLevel(record, -1, () => 0.75);
  assert.equal(next[24], 0); assert.equal(next[28], 0); assert.equal(next[26], 0); assert.equal(next[25], 1);
});

test('level boundaries and stat caps stop at game limits without modifying the source', () => {
  const capped = new Uint8Array(32); capped[24] = 98; capped[29] = 99; capped[26] = 998 & 255; capped[27] = 998 >>> 8;
  const next = stepCharacterLevel(capped, 1, () => 0.99);
  assert.equal(next[24], 99); assert.equal(next[29], 99); assert.equal(next[26] | next[27] << 8, 999);
  assert.deepEqual(stepCharacterLevel(next, 1), next);
  const zero = new Uint8Array(32); assert.deepEqual(stepCharacterLevel(zero, -1), zero);
  assert.throws(() => stepCharacterLevel(new Uint8Array(31), 1), /캐릭터/);
});

test('promotion thresholds cover all three classes for level macros and direct edits', () => {
  for (const [classId, target] of [[0x54, 0x56], [0x55, 0x56], [0x61, 0x35]]) {
    const record = new Uint8Array(32); record[12] = classId; record[13] = 0x90; record[24] = 49;
    const up = stepCharacterLevel(record, 1, () => 0);
    assert.equal(up[24], 50); assert.equal(up[20], target); assert.equal(up[13], 0x92); assert.equal(up[12], classId);
    const down = stepCharacterLevel(up, -1, () => 0);
    assert.equal(down[24], 49); assert.equal(down[20], 0); assert.equal(down[13], 0x90);
    record[24] = 75; const manual = syncCharacterPromotion(record);
    assert.equal(manual[20], target); assert.equal(manual[13], 0x92);
    manual[24] = 3; const reset = syncCharacterPromotion(manual);
    assert.equal(reset[20], 0); assert.equal(reset[13], 0x90);
  }
  const other = new Uint8Array(32); other[12] = 1; other[13] = 0x92; other[20] = 55;
  assert.deepEqual(syncCharacterPromotion(other), other);
});


test('LV 99 exactly matches repeated level-ups with the same random stream', () => {
  for (const level of [0, 1, 48, 49, 50, 96, 98, 99]) {
    const record = new Uint8Array(32).fill(3); record[24] = level; record[12] = 0x61;
    record[26] = 100; record[27] = 0; record[13] = 0x90;
    const before = record.slice();
    const generator = () => { let count = 0; return () => (++count % 7) / 7; };
    const random = generator(); let repeated: Uint8Array = record.slice();
    while (repeated[24] < 99) repeated = stepCharacterLevel(repeated, 1, random);
    const grown = growCharacterTo99(record, generator());
    assert.deepEqual(grown, repeated); assert.equal(grown[24], 99);
    assert.deepEqual(record, before);
    for (const offset of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 19, 21, 22, 23]) assert.equal(grown[offset], record[offset]);
  }
  assert.throws(() => growCharacterTo99(new Uint8Array(31)), /캐릭터/);
});


test('inventory sort writes ascending item/quantity pairs into contiguous saved slots only', () => {
  const bytes = fixture();
  bytes.set([16, 99], 0x492); bytes.set([3, 2], 0x498); bytes.set([2, 0], 0x4a0); bytes.set([3, 5], 0x690);
  bytes[0x495] = 0x79;
  const original = bytes.slice();
  const result = editInventory(bytes, { type: 'sort' });
  assert.deepEqual(result.inventory, [{ slot: 0, id: 2, quantity: 0 }, { slot: 1, id: 3, quantity: 2 }, { slot: 2, id: 3, quantity: 5 }, { slot: 3, id: 16, quantity: 99 }]);
  assert.deepEqual(Array.from(result.data.subarray(0x492, 0x49a)), [2, 0, 3, 2, 3, 5, 16, 99]);
  assert.ok(result.data.subarray(0x49a, 0x692).every(byte => byte === 0));
  assert.deepEqual(result.data.subarray(0, 0x492), original.subarray(0, 0x492));
  assert.deepEqual(result.data.subarray(0x692), original.subarray(0x692));
  assert.deepEqual(bytes, original);
  assert.deepEqual(editInventory(result.data, { type: 'sort' }).data, result.data);
  assert.deepEqual(parseSave(prepareSave(result.data)).inventory, result.inventory);
  assert.deepEqual(editInventory(fixture(), { type: 'sort' }).inventory, []);
});


test('item utility ranking rewards stats and helpful effects and penalizes self-harm', () => {
  assert.ok(itemQualityScore(0x10) > itemQualityScore(0x01));
  assert.ok(itemQualityScore(0x1a) > itemQualityScore(0x02));
  assert.ok(itemQualityScore(0x35) > itemQualityScore(0x01));
  assert.ok(itemQualityScore(0x48) > itemQualityScore(0x44));
  assert.ok(itemQualityScore(0x01) > itemQualityScore(0x06));
  assert.ok(itemQualityScore(0x01) > itemQualityScore(0x07));
  assert.ok(itemQualityScore(0x01) > itemQualityScore(0x08));
  assert.ok(itemQualityScore(0x01) > itemQualityScore(255));
});

test('quality sort changes saved order, preserves pairs, IDs, identification and other bytes', () => {
  const bytes = fixture();
  const pairs = [[1, 99], [7, 20], [0x10, 0], [0x35, 1], [0x10, 3], [255, 7], [4, 2], [3, 8]];
  pairs.forEach((pair, index) => bytes.set(pair, 0x492 + index * 6));
  const original = bytes.slice();
  const result = editInventory(bytes, { type: 'sort-quality' });
  const expected = pairs.map(([id, quantity]) => ({ id, quantity })).sort((a, b) => itemQualityScore(b.id) - itemQualityScore(a.id) || a.id - b.id);
  assert.deepEqual(result.inventory, expected.map((item, slot) => ({ slot, ...item })));
  assert.equal(result.inventory[0].id, 0x10);
  assert.equal(result.inventory.at(-1)!.id, 255);
  assert.deepEqual(result.data.subarray(0, 0x492), original.subarray(0, 0x492));
  assert.deepEqual(result.data.subarray(0x692), original.subarray(0x692));
  assert.deepEqual(editInventory(result.data, { type: 'sort-quality' }).data, result.data);
  assert.deepEqual(parseSave(prepareSave(result.data)).inventory, result.inventory);
  assert.deepEqual(bytes, original);
  assert.deepEqual(editInventory(fixture(), { type: 'sort-quality' }).inventory, []);
});


function troopEditFixture(counts = [3, 2, 0]): Uint8Array {
  const bytes = fixture(); let offset = 0x59a6;
  counts.forEach((count, index) => {
    const header = Uint8Array.from({ length: 16 }, (_, i) => i * 7 + index);
    header[0] = index === 0 ? 0x31 : 0; header[1] = count; header[2] = 1; header[3] = 0; header[6] = index;
    bytes.set(header, offset); offset += 16;
    for (let i = 0; i < count; i++) { const ref = (220 + i) * 32; bytes[offset++] = ref & 255; bytes[offset++] = ref >>> 8; }
  });
  bytes[offset] = 0xff;
  if (offset < 0x7990) bytes[0x79a0] = 0x7b;
  return bytes;
}

test('troop edits preserve unknown headers, other troops, padding and checksum snapshots', () => {
  const bytes = troopEditFixture(); const original = bytes.slice(); const records = readTroopRecords(bytes);
  const changed = editTroop(bytes, 0, { state: 0, id: 18, mapId: 0x0100 });
  const result = readTroopRecords(changed);
  assert.equal(result[0].header[0], 0); assert.equal(result[0].header[6], 18);
  assert.equal(result[0].header[2], 0); assert.equal(result[0].header[3], 1);
  for (let i = 0; i < 16; i++) if (![0, 2, 3, 6].includes(i)) assert.equal(result[0].header[i], records[0].header[i]);
  assert.deepEqual(result.slice(1), records.slice(1));
  assert.deepEqual(changed.subarray(0, 0x59a6), original.subarray(0, 0x59a6));
  assert.deepEqual(changed.subarray(0x79a6), original.subarray(0x79a6));
  assert.equal(changed[0x79a0], 0x7b); assert.deepEqual(bytes, original);
});

test('troop roster resizing shifts later records and round-trips reset without changing their data', () => {
  const bytes = troopEditFixture(); const original = bytes.slice(); const records = readTroopRecords(bytes);
  const members = [639, 0, 639, 220, 221];
  const grown = editTroop(bytes, 0, { members }); const grownRecords = readTroopRecords(grown);
  assert.deepEqual(grownRecords[0].members, members); assert.equal(grownRecords[0].header[1], 5);
  assert.equal(grownRecords[1].offset, records[1].offset + 4);
  assert.deepEqual(grownRecords[1].header, records[1].header); assert.deepEqual(grownRecords[1].members, records[1].members);
  assert.deepEqual(grownRecords[2].header, records[2].header);
  assert.deepEqual(parseSave(prepareSave(grown)).troops[0].members, members);
  const shrunk = editTroop(grown, 0, { members: [] }); const shrunkRecords = readTroopRecords(shrunk);
  assert.equal(shrunkRecords[1].offset, records[1].offset - 6);
  assert.deepEqual(shrunkRecords[1].members, records[1].members); assert.equal(shrunk[0x79a0], 0x7b);
  const reset = editTroop(shrunk, 0, { header: records[0].header, members: records[0].members });
  assert.deepEqual(reset, original); assert.deepEqual(bytes, original);
});

test('troop edits reject reserved states, invalid references and capacity overflow atomically', () => {
  const bytes = troopEditFixture(); const original = bytes.slice();
  for (const change of [{ state: 255 }, { id: 256 }, { mapId: 65536 }, { members: [640] }, { members: [-1] }, { members: [0.5] }, { members: Array(256).fill(0) }, { header: new Uint8Array(15) }]) assert.throws(() => editTroop(bytes, 0, change), RangeError);
  assert.throws(() => editTroop(bytes, -1, {}), RangeError);
  const full = troopEditFixture([...Array(15).fill(255), 140]); const before = full.slice();
  assert.throws(() => editTroop(full, 15, { members: Array(143).fill(220) }), /공간/);
  assert.deepEqual(full, before); assert.deepEqual(bytes, original);
  const broken = fixture(); broken.fill(0, 0x59a6, 0x79a6);
  assert.throws(() => readTroopRecords(broken), /종료|헤더/);
});


test('troop country names and colors decode independent +05 nibbles', () => {
  assert.equal(troopCountryName(0x1d), '마시아');
  assert.equal(troopCountryName(0x5d), '마시아');
  assert.equal(troopCountryColor(0x11), '#F70000');
  assert.equal(troopCountryColor(0x05), '#E600E6');
  assert.equal(troopCountryColor(0x15), '#E600E6');
  assert.equal(troopCountryColor(0x50), '#F7F7F7');
  assert.equal(troopCountryColor(0x16), '#00C5F7');
  assert.equal(troopCountryColor(0xfd), '#F70000');
  const bytes = troopEditFixture();
  bytes[0x59a6 + 5] = 0x1d;
  assert.equal(parseSave(bytes).troops[0].nationGroup, 0x1d);
});


test('troop affiliations retain unknown codes and sorting prioritizes exact state 00', () => {
  assert.equal(troopAffiliationLabel(0x00), '아군');
  assert.equal(troopAffiliationLabel(0x01), '적군');
  assert.equal(troopAffiliationLabel(0xd1), '적군 · 양산형');
  assert.equal(troopAffiliationLabel(0x34), '중립 · 비활성부대');
  assert.equal(troopAffiliationLabel(0x35), '중립 · 비활성부대');
  assert.equal(troopAffiliationLabel(0x30), '아군 · 비활성부대');
  const make = (index: number, state: number, id: number, nationGroup: number) => ({ index, state, id, nationGroup, mapId: 1, memberCount: 0, members: [] });
  const troops = [make(0, 1, 1, 0x1d), make(1, 0, 9, 0), make(2, 0, 2, 0), make(3, 0xd1, 90, 0x12), make(4, 0x30, 0, 0)];
  assert.deepEqual([...troops].sort(compareTroops).map(troop => troop.index), [2, 1, 4, 3, 0]);
  assert.deepEqual(troops.map(troop => troop.index), [0, 1, 2, 3, 4]);
});


test('troop nation suffixes omit Carion allies and enemies and keep templates', () => {
  assert.equal(troopNationSuffix(0, 0), '');
  assert.equal(troopNationSuffix(0, 5), ' (아군)');
  assert.equal(troopNationSuffix(1, 1), '');
  assert.equal(troopNationSuffix(0xd1, 0x1d), ' (양산형)');
  assert.equal(troopNationSuffix(0x34, 2), ' (비활성)');
  assert.equal(troopNationSuffix(0x04, 2), '');
  assert.equal(troopNationSuffix(0x31, 2), ' (비활성)');
  assert.equal(troopNationSuffix(0x35, 3), ' (비활성)');
  assert.equal(troopNationSuffix(0x30, 5), ' (비활성)');
  assert.equal(troopNationSuffix(0x30, 0), ' (비활성)');
  assert.equal(troopCountryColor(7), troopCountryColor(2));
  for (let id = 8; id <= 15; id++) assert.equal(troopCountryColor(id), troopCountryColor(1));
});


test('troop nibble edits preserve counterpart fields and map edits preserve non-player strength', () => {
  const bytes = troopEditFixture(); const original = bytes.slice();
  bytes[0x59a9] = 90;
  const changed = editTroop(bytes, 0, { affiliation: 4, nationId: 13, nationDisplayGroup: 5, mapId: 10, progressFlag: 6 });
  const header = readTroopRecords(changed)[0].header;
  assert.equal(header[0], 0x34); assert.equal(header[5], 0x5d);
  assert.equal(header[2], 10); assert.equal(header[3], 90);
  assert.equal(header[14], 0x60 | (bytes[0x59a6 + 14] & 15));
  const active = editTroop(changed, 0, { activity: 0 });
  assert.equal(readTroopRecords(active)[0].header[0], 4);
  const player = editTroop(active, 0, { affiliation: 0, mapId: 0x0101 });
  assert.deepEqual(Array.from(readTroopRecords(player)[0].header.slice(2, 4)), [1, 1]);
  for (const offset of [4, 6, 7, 8, 9, 10, 11, 12, 13, 15]) assert.equal(header[offset], original[0x59a6 + offset]);
});

test('troop detailed edits validate atomically and keep unrelated records unchanged', () => {
  const bytes = troopEditFixture(); const snapshot = bytes.slice();
  const changed = editTroop(bytes, 0, { strength: 70, entryCode: 10, command: 254, sourceId: 90, previousMapId: 0x0105 });
  const header = readTroopRecords(changed)[0].header;
  assert.equal(header[3], 70); assert.equal(header[4], 10); assert.equal(header[10], 254); assert.equal(header[11], 90);
  assert.equal(header[12], 5); assert.equal(header[13], 1);
  assert.deepEqual(readTroopRecords(changed).slice(1), readTroopRecords(bytes).slice(1));
  for (const change of [{ affiliation: 16 }, { activity: -1 }, { nationId: 1.5 }, { nationDisplayGroup: 16 }, { progressFlag: 16 }, { strength: 256 }, { command: -1 }, { previousMapId: 65536 }, { mapId: 256 }, { state: 0, strength: 1 }, { affiliation: 15, activity: 15 }]) assert.throws(() => editTroop(bytes, 0, change), RangeError);
  assert.deepEqual(bytes, snapshot);
});


test('allied clone ignores soldier IDs, appends an independent header and copies roster references', () => {
  const bytes = troopEditFixture([3, 1, 1, 1]); const records = readTroopRecords(bytes);
  bytes[records[0].offset + 3] = 90; bytes[records[0].offset + 5] = 0x1d;
  for (let i = 1; i < 4; i++) bytes[records[i].offset + 6] = 251 + i;
  const snapshot = bytes.slice(); const before = readTroopRecords(bytes);
  const result = applyTroopMacro(bytes, 0, 'clone-allied'); const after = readTroopRecords(result.data);
  assert.equal(result.id, 0); assert.equal(result.index, 4); assert.equal(after.length, 5);
  assert.deepEqual(after.slice(0, 4), before);
  const copy = after[4]; assert.equal(copy.header[0], 0); assert.equal(copy.header[3], 0); assert.equal(copy.header[5], 0); assert.equal(copy.header[6], 0);
  assert.deepEqual(copy.members, before[0].members);
  assert.equal(copy.header[10], 0);
  for (let i = 0; i < 16; i++) if (![0, 2, 3, 5, 6, 10].includes(i)) assert.equal(copy.header[i], before[0].header[i]);
  assert.deepEqual(result.data.slice(0, 0x59a6), snapshot.slice(0, 0x59a6));
  assert.deepEqual(result.data.slice(0x79a6), snapshot.slice(0x79a6)); assert.deepEqual(bytes, snapshot);
  const again = applyTroopMacro(result.data, 0, 'clone-allied'); assert.equal(again.id, 1);
  const valid = prepareSave(again.data); validateSave(valid);
});

test('forced recruitment changes the source only and allocates max ally ID plus one', () => {
  const bytes = troopEditFixture(); const before = readTroopRecords(bytes);
  const result = applyTroopMacro(bytes, 0, 'recruit-allied'); const after = readTroopRecords(result.data);
  assert.equal(result.index, 0); assert.equal(result.id, 3); assert.equal(after.length, before.length);
  assert.equal(after[0].header[0], 0); assert.equal(after[0].header[6], 3);
  assert.deepEqual(after[0].members, before[0].members); assert.deepEqual(after.slice(1), before.slice(1));
  const internal = editTroop(bytes, 0, { state: 0, mapId: 0x0105 });
  const clone = applyTroopMacro(internal, 0, 'clone-allied');
  assert.deepEqual(Array.from(readTroopRecords(clone.data).at(-1)!.header.slice(2, 4)), [1, 0]);
  assert.equal(readTroopRecords(clone.data).at(-1)!.header[5], 0);
});

test('allied macros reject ID and storage limits without changing the source', () => {
  const bytes = troopEditFixture(); const records = readTroopRecords(bytes); bytes[records[1].offset + 6] = 19;
  const snapshot = bytes.slice();
  for (const mode of ['clone-allied', 'recruit-allied'] as const) assert.throws(() => applyTroopMacro(bytes, 0, mode), /부대 상한/);
  assert.deepEqual(bytes, snapshot);
  const full = troopEditFixture([...Array(15).fill(255), 128]); const original = full.slice();
  assert.throws(() => applyTroopMacro(full, 0, 'clone-allied'), /저장 공간 상한/);
  assert.deepEqual(full, original);
});


test('troop deletion compacts only the selected record, retains IDs and supports an empty list', () => {
  const bytes = troopEditFixture([3, 2, 1]); const snapshot = bytes.slice(); const before = readTroopRecords(bytes);
  const result = applyTroopMacro(bytes, 1, 'delete'); const remaining = readTroopRecords(result.data);
  assert.equal(result.index, -1); assert.equal(remaining.length, 2);
  assert.deepEqual(remaining.map(record => ({ header: record.header, members: record.members })), [before[0], before[2]].map(record => ({ header: record.header, members: record.members })));
  assert.equal(remaining[1].index, 1); assert.equal(remaining[1].header[6], 2);
  assert.equal(remaining[1].offset, before[1].offset);
  assert.deepEqual(result.data.slice(0, 0x59a6), snapshot.slice(0, 0x59a6));
  assert.deepEqual(result.data.slice(0x79a6), snapshot.slice(0x79a6));
  assert.equal(result.data[0x79a0], 0x7b); assert.deepEqual(bytes, snapshot);
  const last = applyTroopMacro(result.data, 0, 'delete'); const empty = applyTroopMacro(last.data, 0, 'delete');
  assert.equal(empty.data[0x59a6], 0xff); assert.deepEqual(readTroopRecords(empty.data), []);
  validateSave(prepareSave(empty.data));
  assert.throws(() => applyTroopMacro(bytes, -1, 'delete'), RangeError);
  assert.throws(() => applyTroopMacro(bytes, before.length, 'delete'), RangeError);
});


test('troop macros protect the protagonist and reject recruiting existing allies', () => {
  const bytes = troopEditFixture(); const ally = editTroop(bytes, 0, { state: 0, id: 0 }); const snapshot = ally.slice();
  assert.throws(() => applyTroopMacro(ally, 0, 'delete'), /주인공 부대/);
  assert.throws(() => applyTroopMacro(ally, 0, 'recruit-allied'), /이미 아군/);
  assert.deepEqual(ally, snapshot);
  const other = editTroop(ally, 0, { id: 3 });
  assert.doesNotThrow(() => applyTroopMacro(other, 0, 'delete'));
  assert.doesNotThrow(() => applyTroopMacro(ally, 0, 'clone-allied'));
});


test('individual POWER contributions sum to troop POWER including duplicate members and enemy bonus', () => {
  const save = fixture();
  const characters = parseSave(save).characters;
  const first = { ...characters[220], hp: 999, recoveryRaw: 0, attack: 40, hit: 50, defense: 60, evasion: 70, item: 0x2d, fatigue: 4 };
  const second = { ...first, index: 221, classId: 0x89, item: 0x10 };
  const byIndex = new Map([[220, first], [221, second]]);
  const troop = { index: 0, state: 0, nationGroup: 0, id: 0, mapId: 1, memberCount: 3, members: [220, 221, 220] };
  const total = characterPower(first) * 2 + characterPower(second);
  assert.equal(troopPower(troop, byIndex), total);
  assert.equal(troopPower({ ...troop, state: 1, mapId: 0x5a01 }, byIndex), total + 90 * 3 * 6);
});


test('member swaps change only the two u16 references within or across troops', () => {
  let bytes = troopEditFixture([3, 2, 1]); bytes = editTroop(bytes, 2, { members: [639] });
  const snapshot = bytes.slice(); const before = readTroopRecords(bytes);
  const within = swapTroopMembers(bytes, { troopIndex: 0, position: 0 }, { troopIndex: 0, position: 2 });
  assert.deepEqual(readTroopRecords(within)[0].members, [222, 221, 220]);
  const swapped = swapTroopMembers(bytes, { troopIndex: 0, position: 0 }, { troopIndex: 2, position: 0 });
  const after = readTroopRecords(swapped);
  assert.deepEqual(after[0].members, [639, 221, 222]); assert.deepEqual(after[2].members, [220]);
  const allowed = new Set([before[0].offset + 16, before[0].offset + 17, before[2].offset + 16, before[2].offset + 17]);
  for (let i = 0; i < bytes.length; i++) if (!allowed.has(i)) assert.equal(swapped[i], bytes[i], `Unexpected write at ${i}`);
  assert.deepEqual(bytes, snapshot);
  assert.deepEqual(swapTroopMembers(bytes, { troopIndex: 0, position: 1 }, { troopIndex: 0, position: 1 }), bytes);
  const undo = swapTroopMembers(swapped, { troopIndex: 0, position: 0 }, { troopIndex: 2, position: 0 }); assert.deepEqual(undo, bytes);
  validateSave(prepareSave(swapped));
});

test('character-list replacement changes one reference and rejects invalid operations atomically', () => {
  const bytes = troopEditFixture([3, 2]); const snapshot = bytes.slice(); const records = readTroopRecords(bytes);
  const changed = replaceTroopMember(bytes, { troopIndex: 0, position: 1 }, 639);
  assert.deepEqual(readTroopRecords(changed)[0].members, [220, 639, 222]);
  const offset = records[0].offset + 18;
  for (let i = 0; i < bytes.length; i++) if (i !== offset && i !== offset + 1) assert.equal(changed[i], bytes[i]);
  for (const slot of [{ troopIndex: -1, position: 0 }, { troopIndex: 2, position: 0 }, { troopIndex: 0, position: -1 }, { troopIndex: 0, position: 3 }, { troopIndex: 0.5, position: 0 }, { troopIndex: 0, position: 1.5 }]) {
    assert.throws(() => swapTroopMembers(bytes, slot, { troopIndex: 0, position: 0 }), RangeError);
    assert.throws(() => replaceTroopMember(bytes, slot, 220), RangeError);
  }
  for (const id of [-1, 640, 1.5]) assert.throws(() => replaceTroopMember(bytes, { troopIndex: 0, position: 0 }, id), RangeError);
  assert.deepEqual(bytes, snapshot);
});


test('NEW moves a member to the same roster tail or transfers it without swapping', () => {
  const bytes = troopEditFixture([3, 2, 0]); const snapshot = bytes.slice(); const before = readTroopRecords(bytes);
  const moved = appendTroopMember(bytes, 0, { kind: 'member', troopIndex: 0, position: 0 });
  assert.deepEqual(readTroopRecords(moved)[0].members, [221, 222, 220]);
  assert.equal(readTroopRecords(moved)[0].header[1], 3);
  const transferred = appendTroopMember(bytes, 2, { kind: 'member', troopIndex: 1, position: 0 }); const after = readTroopRecords(transferred);
  assert.deepEqual(after[1].members, [221]); assert.equal(after[1].header[1], 1);
  assert.deepEqual(after[2].members, [220]); assert.equal(after[2].header[1], 1);
  for (let i = 0; i < after.length; i++) for (let offset = 0; offset < 16; offset++) if (offset !== 1) assert.equal(after[i].header[offset], before[i].header[offset]);
  assert.deepEqual(transferred.slice(0, 0x59a6), bytes.slice(0, 0x59a6)); assert.deepEqual(transferred.slice(0x79a6), bytes.slice(0x79a6));
  const emptySource = appendTroopMember(transferred, 0, { kind: 'member', troopIndex: 1, position: 0 });
  assert.deepEqual(readTroopRecords(emptySource)[1].members, []); assert.equal(readTroopRecords(emptySource).length, 3);
  assert.deepEqual(bytes, snapshot); validateSave(prepareSave(emptySource));
});

test('NEW appends a character and enforces the 18 member limit atomically', () => {
  const bytes = troopEditFixture([17, 1]);
  const added = appendTroopMember(bytes, 0, { kind: 'character', characterId: 639 });
  assert.equal(readTroopRecords(added)[0].members.length, 18); assert.equal(readTroopRecords(added)[0].members.at(-1), 639);
  const snapshot = added.slice();
  assert.throws(() => appendTroopMember(added, 0, { kind: 'character', characterId: 220 }), /18명/);
  assert.throws(() => appendTroopMember(added, 0, { kind: 'member', troopIndex: 1, position: 0 }), /18명/);
  assert.deepEqual(added, snapshot); validateSave(prepareSave(added));
  for (const source of [{ kind: 'character', characterId: 640 }, { kind: 'character', characterId: -1 }, { kind: 'member', troopIndex: 0, position: 17 }, { kind: 'member', troopIndex: -1, position: 0 }] as const) assert.throws(() => appendTroopMember(bytes, 1, source), RangeError);
  assert.throws(() => appendTroopMember(bytes, -1, { kind: 'character', characterId: 220 }), RangeError);
});

test('NEW capacity failure leaves both source and target unchanged', () => {
  const bytes = troopEditFixture([...Array(15).fill(255), 134, 0]); const snapshot = bytes.slice();
  assert.throws(() => appendTroopMember(bytes, 16, { kind: 'character', characterId: 639 }), /저장 공간/);
  assert.deepEqual(bytes, snapshot);
});


test('Ares leader edits require explicit confirmation across swap, replacement, NEW and direct edits', () => {
  const bytes = editTroop(troopEditFixture([3, 2]), 0, { state: 0, id: 0 }); const snapshot = bytes.slice();
  const leader = { troopIndex: 0, position: 0 }, other = { troopIndex: 1, position: 1 };
  for (const operation of [
    () => swapTroopMembers(bytes, leader, other), () => swapTroopMembers(bytes, other, leader),
    () => replaceTroopMember(bytes, leader, 639),
    () => appendTroopMember(bytes, 0, { kind: 'member', ...leader }),
    () => appendTroopMember(bytes, 1, { kind: 'member', ...leader }),
    () => editTroop(bytes, 0, { members: [221, 220, 222] }),
  ]) { assert.throws(operation, /확인/); assert.deepEqual(bytes, snapshot); }
  assert.doesNotThrow(() => swapTroopMembers(bytes, { troopIndex: 0, position: 1 }, other));
  assert.doesNotThrow(() => appendTroopMember(bytes, 0, { kind: 'character', characterId: 639 }));
  const differentTroop = editTroop(bytes, 0, { id: 1 });
  assert.doesNotThrow(() => swapTroopMembers(differentTroop, leader, other));
  const options = { allowAresMove: true };
  assert.equal(readTroopRecords(swapTroopMembers(bytes, leader, other, options))[0].members[0], 221);
  assert.equal(readTroopRecords(replaceTroopMember(bytes, leader, 639, options))[0].members[0], 639);
  assert.deepEqual(readTroopRecords(appendTroopMember(bytes, 0, { kind: 'member', ...leader }, options))[0].members, [221, 222, 220]);
  assert.deepEqual(readTroopRecords(editTroop(bytes, 0, { members: [221, 220, 222], allowAresMove: true }))[0].members, [221, 220, 222]);
  assert.deepEqual(bytes, snapshot);
});
