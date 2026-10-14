# Mini DataLoader 직접 구현 가이드

`blog-api`에서 사용한 `dataloader` 패키지를 **직접 만들어 보면서** 원리를 이해하는 것이 목표입니다.
마지막에는 `blog-api/src/loader/loaders.ts`의 `import DataLoader from 'dataloader'`를
**내가 만든 구현으로 교체**한 뒤 SQL 수가 똑같이 나오는지 확인합니다.

> 각 단계의 **완료 기준**을 만족하면 체크(`[x]`)하고 커밋하세요.
> 커밋 메시지 예: `feat: mini-dataloader step2 - load 배칭 구현`

### 진행 방식: "테스트가 명세다"
1. 각 단계의 테스트를 먼저 작성합니다.
2. **진짜 `dataloader` 패키지**로 테스트를 돌려서 통과하는지 확인합니다. (= 내 테스트가 올바른 명세인지 검증)
3. 같은 테스트를 **내 구현**으로 돌려서 통과할 때까지 구현합니다.

---

## 0. 준비

### 0-1. 프로젝트 세팅
> ⚠️ 반드시 **`mini-dataloader` 폴더에서** 실행하세요. 프롬프트가 `mini-dataloader %`인지 확인!
> `blog-api`에서 실행하면 `blog-api/package.json`이 덮어써집니다.

```bash
cd ~/Desktop/practice/graphQL/mini-dataloader
npm init -y
npm pkg set type=module
npm i -D typescript vitest @types/node tsx
npm i -D dataloader
npx tsc --init
```

- `dataloader`는 비교용 "정답" 구현입니다.
- 💡 zsh는 기본 설정에서 명령줄의 `#`을 주석으로 처리하지 않습니다.
  `npm i -D dataloader # 주석`처럼 치면 `#`도 패키지 이름으로 넘어가서 `EINVALIDTAGNAME` 에러가 납니다.

- [x] `tsconfig.json` (`tsc --init` 기본값은 옵션이 너무 많아서 아래로 교체)
  ```jsonc
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "strict": true,
      "skipLibCheck": true,
      "types": ["node"],   // 기본값 []이면 process 타입을 못 찾음
      "noEmit": true       // 실행은 vitest/tsx가 하니 tsc는 타입 검사만
    },
    "include": ["dataloader", "test", "vitest.config.ts"]
  }
  ```
- [x] `package.json` scripts
  ```json
  "scripts": {
    "test": "vitest run",
    "test:real": "IMPL=real vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc"
  }
  ```
- [x] `vitest.config.ts`: `test/**/*.test.ts`만 실행, 테스트 파일이 0개여도 통과(`passWithNoTests`)

### 0-2. 구현 교체 장치
테스트 파일이 **환경 변수에 따라** 진짜 구현과 내 구현을 바꿔 가며 쓸 수 있게 합니다.

```ts
// test/impl.ts
import type RealDataLoader from 'dataloader';

const mod: { default: unknown } =
  process.env.IMPL === 'real'
    ? await import('dataloader')
    : await import('../dataloader/dataloader.js');

// 타입은 진짜 패키지 기준으로 고정 (내 구현의 타입 검사는 `npm run typecheck`로)
export default mod.default as typeof RealDataLoader;
```

```ts
// test/helpers.ts
import DataLoader from './impl.js';
import type RealDataLoader from 'dataloader';

// batch 함수가 "몇 번", "어떤 keys로" 호출됐는지 기록하는 로더
export function spyLoader<K, V>(
  mapFn: (key: K) => V | Error = (k) => k as unknown as V,
  options?: RealDataLoader.Options<K, V>,
) {
  const calls: K[][] = [];
  const loader = new DataLoader<K, V>(async (keys) => {
    calls.push([...keys]);
    return keys.map(mapFn);
  }, options);
  return { loader, calls };
}
```

> 💡 `dataloader.ts`가 비어 있는 지금은 `npm run typecheck`가
> `Property 'default' is missing` 에러를 냅니다. **정상입니다.**
> Step 1에서 `export default class DataLoader`를 작성하면 사라집니다.

### 최종 폴더 구조 (목표)
```
mini-dataloader/
├── GUIDE.md                 ← 이 파일
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── dataloader/
│   └── dataloader.ts        # 내 구현 (default export class DataLoader)
└── test/
    ├── impl.ts              # 진짜/내 구현 교체
    ├── helpers.ts
    ├── batch.test.ts        # Step 2
    ├── errors.test.ts       # Step 3
    ├── cache.test.ts        # Step 4
    ├── load-many.test.ts    # Step 5
    ├── options.test.ts      # Step 6
    └── schedule.test.ts     # Step 7
```

### 완료 기준
- [x] `npm run test:real`, `npm test`가 (테스트가 0개라도) 에러 없이 실행됨

---

## Step 1. 뼈대: 타입과 공개 API 정하기

`blog-api`가 쓰는 코드를 **고치지 않고** 교체할 수 있어야 하므로, 공개 API는 원본과 똑같이 맞춥니다.

### 과제
- [ ] `dataloader/dataloader.ts`에 아래 뼈대 작성 (본문은 아직 `throw new Error('TODO')`)
  ```ts
  export type BatchLoadFn<K, V> = (
    keys: ReadonlyArray<K>,
  ) => PromiseLike<ArrayLike<V | Error>>;

  export interface CacheMap<K, V> {
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
    delete(key: K): unknown;
    clear(): unknown;
  }

  export interface Options<K, V, C = K> {
    batch?: boolean;                               // 기본 true
    maxBatchSize?: number;                         // 기본 Infinity
    batchScheduleFn?: (callback: () => void) => void;
    cache?: boolean;                               // 기본 true
    cacheKeyFn?: (key: K) => C;                    // 기본 key => key
    cacheMap?: CacheMap<C, Promise<V>> | null;     // 기본 new Map()
    name?: string;
  }

  export default class DataLoader<K, V, C = K> {
    constructor(batchLoadFn: BatchLoadFn<K, V>, options?: Options<K, V, C>) {}

    load(key: K): Promise<V> {}
    loadMany(keys: ArrayLike<K>): Promise<Array<V | Error>> {}
    clear(key: K): this {}
    clearAll(): this {}
    prime(key: K, value: V | PromiseLike<V> | Error): this {}
  }
  ```

### 생각해볼 것
- [ ] 왜 batch 함수의 인자가 `K[]`가 아니라 `ReadonlyArray<K>`일까요?
  (`blog-api`에서 `[...ids]`로 복사했던 이유와 연결해 보기)
- [ ] 왜 반환 타입이 `V[]`가 아니라 `(V | Error)[]`일까요?
- [ ] `clear`, `prime`이 `this`를 반환하면 어떤 코드를 쓸 수 있나요? (`loader.clear(1).prime(1, user)`)

### 완료 기준
- [ ] `npx tsc --noEmit` 통과
- [ ] `blog-api/src/loader/loaders.ts`의 사용법(`new DataLoader<number, User | null>(async (ids) => ...)`)이 이 타입으로 컴파일되는지 머릿속으로(또는 복사해서) 확인

---

## Step 2. `load()`와 배칭 ⚠️ 핵심

DataLoader의 본질은 단 하나입니다.
> **같은 틱(tick)에 들어온 `load(key)` 호출을 모아 두었다가, 나중에 batch 함수를 한 번만 호출한다.**

### 2-1. 개념 정리 (코드 작성 전에 먼저 답해보기)
- [ ] `load(key)`는 **즉시** 무엇을 반환해야 하나요? (값? Promise?)
- [ ] 그 Promise의 `resolve`/`reject`는 **누가, 언제** 호출하나요?
- [ ] "모아 둔다"는 것을 자료구조로 표현하면?
  ```ts
  type Batch<K, V> = {
    hasDispatched: boolean;
    keys: K[];
    callbacks: { resolve: (v: V) => void; reject: (e: Error) => void }[];
  };
  ```
- [ ] "나중에"는 정확히 언제일까요? 일단은 아래로 시작하고, Step 7에서 깊게 다룹니다.
  ```ts
  // 임시 스케줄러: 현재 동기 코드 + 이미 쌓인 Promise 작업들이 끝난 뒤 실행
  const schedule = (fn: () => void) =>
    Promise.resolve().then(() => process.nextTick(fn));
  ```

### 2-2. 구현 과제
- [ ] `load(key)` 흐름 구현
  1. 현재 batch가 없거나 이미 dispatch됐으면 **새 batch를 만들고 dispatch를 예약**
  2. batch의 `keys`에 key를, `callbacks`에 `{ resolve, reject }`를 push
  3. Promise 반환
- [ ] `dispatchBatch(batch)` 구현
  1. `batch.hasDispatched = true`
  2. `batchLoadFn(batch.keys)` 호출 (**1번만**)
  3. 결과의 `i`번째 값으로 `callbacks[i].resolve(...)`

### 테스트 (예시)
```ts
// test/batch.test.ts
import { describe, it, expect } from 'vitest';
import { spyLoader } from './helpers.js';

describe('batching', () => {
  it('같은 틱의 load는 batch 함수 1번으로 묶인다', async () => {
    const { loader, calls } = spyLoader<number, number>();
    const [a, b] = await Promise.all([loader.load(1), loader.load(2)]);
    expect([a, b]).toEqual([1, 2]);
    expect(calls).toEqual([[1, 2]]);
  });

  // TODO: 아래 케이스도 직접 작성
  // - await로 나뉜 load는 batch가 2번으로 나뉜다
  // - 결과가 keys 순서대로 돌아온다 (batch 함수가 순서를 뒤집어 반환하면? → 그건 batch 함수 책임!)
  // - load만 하고 await 안 해도 batch 함수는 호출된다
});
```

### 완료 기준
- [ ] `npm run test:real`, `npm test` 둘 다 통과
- [ ] `[1, 2]`처럼 **배열 하나**로 묶여 호출되는 것을 `calls`로 확인

---

## Step 3. batch 함수 결과 검증과 에러 처리

`blog-api` Step 5에서 지켰던 **batch 함수 규칙**을 이제 "지키게 만드는 쪽"에서 구현합니다.

### 과제
- [ ] **결과 검증**: 아래 경우는 batch에 속한 **모든** load를 `TypeError`로 reject
  - batch 함수가 Promise를 반환하지 않음
  - 결과가 배열(ArrayLike)이 아님
  - 결과 길이 ≠ keys 길이
  - 에러 메시지에 keys와 결과를 포함하면 디버깅이 쉬워집니다
- [ ] **batch 전체 실패**: batch 함수가 throw하거나 reject하면 → 모든 load를 그 에러로 reject
- [ ] **개별 실패**: 결과의 `i`번째 값이 `Error` 인스턴스면 → `i`번째 load만 reject, 나머지는 정상 resolve

### 테스트 케이스 (직접 작성)
- [ ] 길이가 다른 배열을 반환하면 모든 load가 reject
- [ ] batch 함수가 reject하면 모든 load가 같은 에러로 reject
- [ ] `[1, new Error('x'), 3]`을 반환하면 2번째만 reject
- [ ] batch 함수가 **동기적으로 throw**해도 프로세스가 죽지 않고 reject로 전달됨

### 생각해볼 것
- [ ] 왜 batch 함수 하나가 길이를 틀리면 **전부** 실패시킬까요? 일부만 맞춰 주면 안 될까요?
- [ ] `blog-api`의 `createByIdLoader`에서 `?? null` 대신 아무것도 안 채우면 어떤 에러가 났을까요?

### 완료 기준
- [ ] 진짜/내 구현 모두 통과

---

## Step 4. 캐싱과 `clear` / `clearAll` / `prime`

### 4-1. 개념 정리
- [ ] 캐시에 **값**을 저장할까요, **Promise**를 저장할까요?
  - 힌트: 아직 batch 함수가 끝나기 전에 같은 key로 `load`가 또 오면?
- [ ] 같은 batch 안에서 같은 key가 두 번 `load`되면 batch 함수의 keys에 중복이 들어가야 할까요?

### 4-2. 구현 과제
- [ ] `load(key)` 시작 부분에 캐시 확인 → 있으면 **그 Promise를 그대로** 반환 (batch에 넣지 않음)
- [ ] 새 Promise를 만들면 캐시에 저장
- [ ] **batch 전체 실패 시** 해당 batch의 keys를 캐시에서 **삭제**
  (일시적 DB 오류가 요청 끝까지 캐시되면 안 되니까)
- [ ] `clear(key)`: 캐시에서 해당 key 삭제, `this` 반환
- [ ] `clearAll()`: 캐시 전체 비우기, `this` 반환
- [ ] `prime(key, value)`:
  - 캐시에 **이미 있으면 아무것도 하지 않음** (덮어쓰려면 `clear(key).prime(key, value)`)
  - `value`가 `Error`면 reject된 Promise를 캐시
  - 그 외에는 resolve된 Promise를 캐시

### 테스트 케이스 (직접 작성)
- [ ] 같은 key를 두 번 load → batch 함수의 keys에 1번만 들어감, 두 Promise가 **같은 객체**(`toBe`)
- [ ] await 후 같은 key를 다시 load → batch 함수 호출 없음
- [ ] `clear(1)` 후 load → 다시 batch 함수 호출
- [ ] `prime(1, 'a')` 후 load(1) → batch 함수 호출 없이 `'a'`
- [ ] `prime`은 기존 캐시를 덮어쓰지 않음
- [ ] batch 함수가 reject한 뒤 같은 key를 다시 load → **재시도**됨
- [ ] `[new Error('x')]`처럼 **개별** 에러는? 진짜 구현으로 돌려보고 동작을 기록하기
  (원본은 개별 에러를 캐시에 남깁니다. 왜 그렇게 설계했을지 생각해보기)

### 생각해볼 것
- [ ] `blog-api` Step 6에서 `createComment` 후에 `clear()`/`prime()`을 호출했던 이유를 내 구현 기준으로 다시 설명해 보기
- [ ] 이 캐시가 **요청마다 새로 만들어져야** 하는 이유 (전역 싱글톤이면?)

### 완료 기준
- [ ] 진짜/내 구현 모두 통과

---

## Step 5. `loadMany()`

### 과제
- [ ] `loadMany(keys)` 구현
  - 각 key에 대해 `this.load(key)`를 호출 (→ 자동으로 같은 batch에 들어감)
  - **하나가 실패해도 전체가 reject되지 않음**: 실패한 자리에 `Error` 객체를 넣은 배열로 resolve
  - 인자가 배열이 아니면 `TypeError` (`loadMany(1)` 같은 실수 방지)

### 테스트 케이스 (직접 작성)
- [ ] `loadMany([1, 2, 3])` → batch 1번, `[1, 2, 3]`
- [ ] 2번만 Error → `[1, Error, 3]` (reject 아님)

### 생각해볼 것
- [ ] `Promise.all(keys.map(k => loader.load(k)))`과 `loadMany`의 차이는?
- [ ] `Promise.allSettled`로 구현하면 결과 모양이 어떻게 다른가요?

### 완료 기준
- [ ] 진짜/내 구현 모두 통과

---

## Step 6. 옵션

하나씩 추가하고, 추가할 때마다 이전 단계 테스트가 깨지지 않는지 확인합니다.

### 과제
- [ ] `batch: false` → 배칭 없이 key마다 batch 함수를 `[key]`로 즉시(예약 후) 호출
  - 힌트: `maxBatchSize = 1`과 같은 효과
- [ ] `maxBatchSize: n` → batch의 keys가 n개가 되면 **새 batch**를 시작
  - 힌트: "현재 batch를 재사용할 수 있는 조건"에 `keys.length < maxBatchSize` 추가
- [ ] `cache: false` → 캐시를 아예 쓰지 않음
  - 이때 같은 key를 두 번 load하면 keys에 **중복이 들어감** (진짜 구현으로 확인)
- [ ] `cacheKeyFn` → 캐시 조회/저장/삭제 시 `key` 대신 `cacheKeyFn(key)` 사용
  - batch 함수에는 **원래 key**가 전달되어야 함
- [ ] `cacheMap` → `new Map()` 대신 사용자가 준 객체를 캐시로 사용 (`get/set/delete/clear`만 사용)
- [ ] `batchScheduleFn` → Step 2의 임시 `schedule` 대신 사용자가 준 함수로 dispatch 예약
- [ ] 잘못된 옵션 검증: `maxBatchSize`가 1 미만, `batchScheduleFn`이 함수가 아님 등 → `TypeError`

### 테스트 케이스 (직접 작성)
- [ ] `maxBatchSize: 2`로 5개 load → `calls`가 `[[1,2],[3,4],[5]]`
- [ ] `cacheKeyFn: (k) => JSON.stringify(k)`로 `{ id: 1 }`을 두 번 load → batch 1번에 key 1개
- [ ] `batchScheduleFn: (cb) => setTimeout(cb, 10)` → 10ms 안에 들어온 load가 한 batch로 묶임

### 생각해볼 것
- [ ] `blog-api` Step 6의 `User.posts(published: Boolean)`처럼 **객체 key**를 쓸 때 `cacheKeyFn`이 없으면 왜 캐시가 안 맞나요? (`{a:1} === {a:1}`?)
- [ ] `maxBatchSize`는 실무에서 왜 필요할까요? (`WHERE id IN (...)`에 key가 10,000개면?)
- [ ] `cacheMap`에 LRU 캐시를 넣으면 어떤 상황에서 유용할까요?

### 완료 기준
- [ ] 진짜/내 구현 모두 통과

---

## Step 7. 스케줄링 심화 🎯 "같은 틱"이란 정확히 무엇인가

Step 2의 `Promise.resolve().then(() => process.nextTick(fn))`가 왜 이런 모양인지 실험으로 이해합니다.

### 7-1. 개념 정리
- [ ] Node 이벤트 루프에서 아래 4가지가 실행되는 순서를 적어 보기
  - 동기 코드 / `process.nextTick` / Promise 콜백(microtask) / `setTimeout(0)`·`setImmediate`(macrotask)
- [ ] 간단한 스크립트로 직접 확인 (`npx tsx scratch.ts`)

### 7-2. 실험 과제
`batchScheduleFn` 옵션을 이용해 스케줄러 3가지를 비교합니다.

```ts
const schedulers = {
  microtask: (cb: () => void) => queueMicrotask(cb),
  postPromiseNextTick: (cb: () => void) => Promise.resolve().then(() => process.nextTick(cb)),
  timeout: (cb: () => void) => setTimeout(cb, 0),
};
```

- [ ] GraphQL resolver를 흉내 낸 코드로 **batch 함수 호출 횟수** 비교
  ```ts
  // 글 50개의 author를 resolve한다고 가정
  // 각 resolver가 load 전에 await를 몇 번 거치는 상황 (미들웨어, guard, 권한 체크 등)
  async function resolveAuthor(postId: number) {
    await Promise.resolve();
    await Promise.resolve();
    return loader.load(postId % 10);
  }
  await Promise.all(Array.from({ length: 50 }, (_, i) => resolveAuthor(i)));
  ```
- [ ] 결과 기록표 (직접 채우기)

| 스케줄러 | await 0번 | await 2번 | await 횟수가 resolver마다 다름 | 응답 지연 |
| --- | --- | --- | --- | --- |
| `queueMicrotask` | | | | |
| `Promise.then → nextTick` | | | | |
| `setTimeout(0)` | | | | |

### 생각해볼 것
- [ ] `queueMicrotask`만 쓰면 왜 batch가 쪼개질 수 있나요?
- [ ] `setTimeout`이 가장 잘 묶는데도 원본이 기본값으로 쓰지 않는 이유는? (지연, 다른 I/O 끼어들기)
- [ ] 원본 소스의 `enqueuePostPromiseJob`을 읽고 내 설명과 비교해 보기
  (`node_modules/dataloader/index.js`)

### 완료 기준
- [ ] 기록표 완성
- [ ] 기본 스케줄러를 정한 이유를 한두 문장으로 정리해 **회고**에 남기기

---

## Step 8. `blog-api`에 적용하기 🎯 메인 목표

### 과제
- [ ] 내 구현을 `blog-api`로 가져오기 (둘 중 하나)
  - **A. 복사 (추천)**: `dataloader.ts`를 `blog-api/src/loader/mini-dataloader.ts`로 복사
  - B. 로컬 패키지: `mini-dataloader`를 빌드해서 `npm i ../mini-dataloader`
    (`exports`, `types`, 빌드 산출물 설정이 필요해서 손이 더 많이 감)
- [ ] `blog-api/src/loader/loaders.ts`의 import 한 줄만 교체
  ```ts
  // import DataLoader from 'dataloader';
  import DataLoader from './mini-dataloader.js';
  ```
- [ ] **resolver, 데코레이터, `clear()`/`prime()` 코드는 하나도 고치지 않기** (고쳐야 한다면 API가 원본과 다른 것)

### 완료 기준
- [ ] `blog-api` Step 5 기록표와 **같은 SQL 수**가 나오는지 확인

| GraphQL Query | `dataloader` 패키지 | 내 구현 |
| --- | --- | --- |
| `posts { author }` | 2 | |
| `posts { comments { author } }` | 3 | |
| `users { posts }` | 2 | |
| `posts { author, comments { author } }` | 3 | |

- [ ] 콘솔 SQL에서 `WHERE id IN (...)` 형태가 나오는지 확인
- [ ] 숫자가 다르면 원인 찾기 (스케줄러? 캐시 공유? 중복 key?)

---

## 보너스 과제 (여유 있을 때)
- [ ] `name` 옵션과 디버그 로그: batch마다 `[userById] batch(10 keys)` 출력
- [ ] 같은 batch 안의 **캐시 hit** Promise도 batch 결과와 같은 시점에 resolve되도록 맞추기
  (원본 v2.2의 `cacheHits` 참고. 왜 필요한지부터 생각해보기)
- [ ] 원본 테스트(`dataloader` GitHub 저장소의 `src/__tests__`)를 가져와 내 구현으로 돌려 보기
- [ ] `AbortSignal` 지원 설계해 보기 (요청이 취소되면 batch도 취소?)

---

## 참고 자료
- DataLoader 저장소: https://github.com/graphql/dataloader
  - 소스가 단일 파일(`src/index.js`) 약 500줄이라 **구현을 마친 뒤** 읽어 보기 좋습니다
- Node.js 이벤트 루프: https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick
- Lee Byron, "DataLoader – Source code walkthrough" (YouTube)

---

## 회고
<!-- 각 단계의 "생각해볼 것" 답변과 Step 7 결론을 여기에 작성 -->
<!--
1. DataLoader가 "배칭"을 할 수 있는 이유를 이벤트 루프 관점에서 설명하면?
2. 캐시에 값이 아니라 Promise를 저장하는 이유는?
3. batch 함수 규칙(순서, 길이)을 어기면 왜 전체를 실패시키나?
4. 직접 만들어 보고 나서 blog-api 코드에서 새로 보이게 된 것은?
-->
