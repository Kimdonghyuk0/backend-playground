import { describe, it, expect } from 'vitest';
import { spyLoader } from './helpers.js';

// describe: 관련된 테스트를 묶는 "폴더" 같은 것 (이름은 자유)
describe('batching', () => {
  // it: 테스트 1개. 첫 인자는 "무엇을 확인하는지" 문장으로 쓴다.
  // load가 Promise를 반환하니까 async 함수로 만들고 await로 기다린다.
  it('같은 틱의 load는 batch 함수 1번으로 묶인다', async () => {
    // ① 준비 (Arrange)
    // spyLoader: batch 함수가 받은 keys를 calls 배열에 기록하는 로더
    // 기본 mapFn은 key를 그대로 돌려준다 → load(1)의 결과는 1
    const { loader, calls } = spyLoader<number, number>();

    // ② 실행 (Act)
    // await 없이 load를 연달아 호출 = "같은 틱"에 호출
    // Promise.all로 두 결과를 한 번에 기다린다.
    const [a, b] = await Promise.all([loader.load(1), loader.load(2)]);

    // ③ 검증 (Assert)
    // expect(실제값).toEqual(기대값): 내용이 같은지 비교 (배열/객체 OK)
    expect(a).toBe(1); // 각 load가 자기 key의 결과를 받았는지
    expect(b).toBe(2);
    expect(calls).toEqual([[1, 2]]); // batch 함수가 "딱 1번", keys [1, 2]로 호출됐는지
    // ↑ 배칭이 안 되면 calls는 [[1], [2]]가 되어 여기서 실패한다.
  });

  // 배치는 private이라 직접 못 본다. 대신 두 가지로 확인한다:
  //   1) calls: batch 함수 호출 1번 = 배치 1개
  //   2) batchScheduleFn: 새 배치가 만들어질 때마다 호출됨 → 호출 횟수 = 배치 생성 횟수

  it('key는 load한 순서 그대로 batch 함수에 전달된다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    await Promise.all([loader.load(3), loader.load(1), loader.load(2)]);

    expect(calls).toEqual([[3, 1, 2]]); // 결과를 index로 매칭하니까 순서가 중요
  });

  it('배치는 같은 틱 동안 1개만 만들어지고, dispatch되면 다음 load는 새 배치를 만든다', async () => {
    // dispatch를 자동으로 하지 않고 배열에 모아 뒀다가 내가 직접 실행한다
    const scheduled: Array<() => void> = [];
    const { loader, calls } = spyLoader<number, number>((k) => k, {
      batchScheduleFn: (dispatch) => scheduled.push(dispatch),
    });

    const p1 = loader.load(1);
    const p2 = loader.load(2);
    expect(scheduled.length).toBe(1); // load 2번 → 배치는 1개 (두 번째 load는 기존 배치에 key 추가)

    scheduled[0](); // 첫 배치 dispatch → 이 배치는 이제 끝난 배치 (key 추가 불가)

    const p3 = loader.load(3);
    expect(scheduled.length).toBe(2); // 끝난 배치에는 못 넣으니 새 배치가 생김

    scheduled[1]();
    expect(await Promise.all([p1, p2, p3])).toEqual([1, 2, 3]);
    expect(calls).toEqual([[1, 2], [3]]);
  });

  it('조회가 끝난 뒤에 load하면 이전 배치를 재사용하지 않고 새 배치로 간다', async () => {
    const { loader, calls } = spyLoader<number, number>();

    await loader.load(1);
    await loader.load(2);

    expect(calls).toEqual([[1], [2]]); // 다른 틱이라 각각 다른 배치
  });

  it('dispatch 전에 load하지 않으면 배치도 만들어지지 않는다', async () => {
    const scheduled: Array<() => void> = [];
    spyLoader<number, number>((k) => k, {
      batchScheduleFn: (dispatch) => scheduled.push(dispatch),
    });

    expect(scheduled.length).toBe(0); // new DataLoader만으로는 배치가 생기지 않음
  });

  it('maxBatchSize를 넘으면 배치가 나뉜다', async () => {
    const { loader, calls } = spyLoader<number, number>((k) => k, { maxBatchSize: 2 });

    const values = await loader.loadMany([1, 2, 3, 4, 5]);

    expect(values).toEqual([1, 2, 3, 4, 5]); // 나뉘어도 결과는 각자 key에 맞게
    expect(calls).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('batch: false면 load마다 배치가 따로 만들어진다', async () => {
    const { loader, calls } = spyLoader<number, number>((k) => k, { batch: false });

    await Promise.all([loader.load(1), loader.load(2)]);

    expect(calls).toEqual([[1], [2]]);
  });
});
