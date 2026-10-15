import { describe, it, expect } from 'vitest';
import { spyLoader } from './helpers.js';

describe('캐시', () => {
  it('같은 key를 두 번 load하면 batch 함수에는 key가 한 번만 간다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    const [a, b] = await Promise.all([loader.load(1), loader.load(1)]);

    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toEqual([[1]]); // 캐시가 없으면 [[1, 1]]이 된다
  });

  it('조회가 끝난 뒤(다음 틱)에 다시 load해도 batch 함수를 다시 호출하지 않는다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    await loader.load(1); // 첫 조회 → batch 함수 호출
    const again = await loader.load(1); // 캐시 hit → 호출 없어야 함

    expect(again).toBe(1);
    expect(calls).toEqual([[1]]); // 캐시가 없으면 [[1], [1]]
  });

  it('clear(key) 하면 그 key만 캐시에서 지워져 다시 조회한다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    await Promise.all([loader.load(1), loader.load(2)]);
    loader.clear(1);
    await Promise.all([loader.load(1), loader.load(2)]);

    // 두 번째 조회에서는 지워진 1만 batch 함수로 간다 (2는 캐시 hit)
    expect(calls).toEqual([[1, 2], [1]]);
  });

  it('clearAll() 하면 모든 key를 다시 조회한다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    await Promise.all([loader.load(1), loader.load(2)]);
    loader.clearAll();
    await Promise.all([loader.load(1), loader.load(2)]);

    expect(calls).toEqual([[1, 2], [1, 2]]);
  });

  it('prime으로 미리 넣은 값은 batch 함수 없이 바로 나온다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    loader.prime(1, 100);
    const value = await loader.load(1);

    expect(value).toBe(100); // batch 함수였다면 1이 나왔을 것
    expect(calls).toEqual([]); // batch 함수는 한 번도 호출되지 않음
  });


  it('cacheMap 옵션으로 넘긴 Map에 key → Promise가 저장된다', async () => {
    const map = new Map<number, Promise<number>>();
    const { loader } = spyLoader<number, number>((k) => k * 10, { cacheMap: map });

    const promise = loader.load(1);

    // load 직후, 조회가 끝나기 전에도 이미 Map에 들어 있다 (값이 아니라 Promise가 저장됨)
    expect(map.has(1)).toBe(true);
    expect(map.get(1)).toBeInstanceOf(Promise);

    await promise;
    expect(await map.get(1)).toBe(10); // 저장된 Promise를 await하면 조회된 값

    loader.clear(1);
    expect(map.has(1)).toBe(false); // clear하면 Map에서도 빠진다
  });

  it('batch 함수가 통째로 실패하면 캐시에서 지워져 다음 load 때 다시 조회한다', async () => {
    let fail = true;
    const { loader, calls } = spyLoader<number, number>((k) => {
      if (fail) throw new Error('DB 장애');
      return k;
    });

    await expect(loader.load(1)).rejects.toThrow('DB 장애');

    fail = false; // DB 복구
    const value = await loader.load(1);

    expect(value).toBe(1); // 실패한 Promise가 캐시에 남아 있었다면 또 에러가 났을 것
    expect(calls).toEqual([[1], [1]]);
  });

  it('cache: false면 같은 key도 매번 조회한다', async () => {
    const { loader, calls } = spyLoader<number, number>((k) => k, { cache: false });

    await Promise.all([loader.load(1), loader.load(1)]);

    expect(calls).toEqual([[1, 1]]); // 배칭은 되지만 중복 제거(캐시)는 안 됨
  });
});
