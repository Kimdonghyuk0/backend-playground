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
});
