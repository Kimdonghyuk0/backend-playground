// ─────────────────────────────────────────────────────────────────────────────
// Mini DataLoader
//
// 하는 일: 여러 곳에서 따로 부른 load(1), load(2), load(3)을 모아서
//         batch 함수를 "딱 한 번" batchFn([1, 2, 3])으로 호출한다. (N+1 문제 해결)
//
// 사용자가 주는 것 (Input)
//   1. 생성할 때: batch 함수 = "key 목록을 받으면 값 목록을 가져오는 방법" (DB 조회는 여기서 사용자가 함)
//      사용자는 함수를 "정의"만 한다. key 목록(ids)은 DataLoader가 load()들을 모아서 넣어 준다
//        const userLoader = new DataLoader(async (ids) => { // ids = DataLoader가 모은 [1, 2, 3]
//          const users = await prisma.user.findMany({ where: { id: { in: ids } } });
//          return ids.map((id) => users.find((u) => u.id === id) ?? null); // ids와 같은 순서, 같은 개수
//        });
//   2. 쓸 때: key 하나씩 따로 요청 (모으는 건 DataLoader가 함)
//        userLoader.load(1); userLoader.load(2); userLoader.load(3);
//
// 사용자가 받는 것 (Output)
//   - load(key)      → Promise<값>            예) await userLoader.load(1)        → { id: 1, name: '철수' }
//   - loadMany(keys) → Promise<(값 | Error)[]> 예) await userLoader.loadMany([1, 2]) → [유저1, 유저2]
//   - 같은 시점에 load를 여러 번 불러도 batch 함수(=DB 조회)는 한 번만 실행된다
//
// 흐름:
//   load(key)
//     ├─ 캐시에 있음 → 캐시된 Promise 바로 반환
//     └─ 캐시에 없음 → 바구니(batch)에 key를 담고 Promise 반환
//                       ↓ (지금 실행 중인 코드가 다 끝난 뒤)
//                    dispatchBatch: batchFn(바구니의 keys) 한 번 호출
//                       ↓
//                    결과[i]로 i번째 Promise를 resolve/reject
// ─────────────────────────────────────────────────────────────────────────────

// batch 함수의 모양: key 목록을 받아 "같은 순서, 같은 개수"의 결과 목록을 Promise로 반환
//   - ReadonlyArray: keys를 바꾸지 말라는 뜻 (DataLoader가 keys[i] ↔ 결과[i]로 짝지음)
//   - V | Error: 특정 key만 실패시킬 때 그 자리에 Error를 넣는다
export type BatchLoadFn<K, V> = ( //이건 사용자가 주는 함수이고 주로 데이터베이스에서 조회를 하는 함수를 준다.
  keys: ReadonlyArray<K>,
) => PromiseLike<ArrayLike<V | Error>>;

// 캐시 저장소의 모양. JS 기본 Map이 이 4개 메서드를 이미 갖고 있어서 new Map()을 그대로 쓴다
export interface CacheMap<K, V> { // 캐시맵임 그냥 유저 키값-데이터 저장하는곳
  get(key: K): V | undefined; // 꺼내기 (없으면 undefined)
  set(key: K, value: V): unknown; // 넣기 (Java의 put)
  delete(key: K): unknown; // 하나 지우기
  clear(): unknown; // 전부 지우기
}
 
// new DataLoader(batchFn, 옵션)의 옵션. 전부 생략 가능
export interface Options<K, V, C = K> { // 옵션들
  batch?: boolean; // false면 배칭 안 함 (기본 true)
  maxBatchSize?: number; // 한 번에 묶을 최대 key 개수 (기본 무제한)
  batchScheduleFn?: (callback: () => void) => void; // batch 함수를 "언제" 부를지 (기본 nextTick)
  cache?: boolean; // false면 캐시 안 함 (기본 true)
  cacheKeyFn?: (key: K) => C; // key를 캐시용 key로 바꾸는 함수. 객체 key일 때 사용 (기본 key 그대로)
  cacheMap?: CacheMap<C, Promise<V>> | null; // 직접 만든 캐시 저장소 (기본 new Map())
  name?: string; // 디버깅용 이름
}

// 바구니: 모아 둔 key들과, 각 key의 Promise를 끝낼 함수(resolve/reject)
//   keys[i]의 결과는 callbacks[i]로 전달된다 (같은 index끼리 짝)
type Batch<K, V> = { 
  hasDispatched: boolean; // batch 함수를 이미 호출했는지
  keys: K[];
  callbacks: Array<{ resolve: (value: V) => void; reject: (error: Error) => void }>;
};

export default class DataLoader<K, V, C = K> { // 사용자가 new DataLoader(batchFn, 옵션)으로 만들고, load(key)로 key 하나씩 요청하면 된다
  private batchLoadFn: BatchLoadFn<K, V>;
  private batch: Batch<K, V> | null = null; // 지금 key를 모으고 있는 바구니
  private maxBatchSize: number;
  private batchScheduleFn: (callback: () => void) => void;
  private cacheKeyFn: (key: K) => C;
  private cacheMap: CacheMap<C, Promise<V>> | null; // null = 캐시 안 씀
  public name: string | null;

  constructor(batchLoadFn: BatchLoadFn<K, V>, options?: Options<K, V, C>) {
    if (typeof batchLoadFn !== 'function') {
      throw new TypeError(
        `DataLoader는 keys 배열을 받아 Promise<값 배열>을 반환하는 함수로 만들어야 합니다. 받은 값: ${String(batchLoadFn)}`,
      );
    }
    this.batchLoadFn = batchLoadFn;
    // 옵션 검사 + 기본값은 파일 아래 getValid... 함수들이 담당
    this.maxBatchSize = getValidMaxBatchSize(options);
    this.batchScheduleFn = getValidBatchScheduleFn(options);
    this.cacheKeyFn = getValidCacheKeyFn(options);
    this.cacheMap = getValidCacheMap(options);
    this.name = options?.name || null;
  } // 여기서 이제 DataLoader 객체가 만들어지고, batchLoadFn과 옵션들이 설정된다. 이제 load(key)를 호출하면 캐시를 확인하고, 없으면 바구니에 key를 담고 Promise를 반환한다. 나중에 batchScheduleFn이 호출되면 dispatchBatch가 실행되어 batchLoadFn이 한 번만 호출되고, 결과가 각 Promise에 전달된다.

  // key 하나의 값을 요청한다. 값은 바로 안 나오고 Promise로 나중에 받는다
  load(key: K): Promise<V> {
    // 1. 캐시에 있으면 그대로 반환 (DB 안 감)
    const cacheMap = this.cacheMap;
    const cacheKey = this.getCacheKey(key);
    if (cacheMap) {
      const cached = cacheMap.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 2. 바구니에 key를 담고, 나중에 결과를 받을 Promise를 만든다
    //    resolve/reject를 바구니에 보관해 두면 dispatchBatch가 결과가 나왔을 때 호출해 준다
    const batch = this.getCurrentBatch();
    const promise = new Promise<V>((resolve, reject) => {
      batch.keys.push(key);
      batch.callbacks.push({ resolve, reject });
    });

    // 3. 캐시에 저장 (값이 아니라 Promise를 저장 → 결과가 나오기 전에 같은 key가 와도 중복 요청 안 함)
    if (cacheMap) {
      cacheMap.set(cacheKey, promise);
    }
    return promise;
  }

  // 지금 key를 담을 바구니를 돌려준다
  private getCurrentBatch(): Batch<K, V> {
    const existing = this.batch;
    // 기존 바구니를 계속 쓸 수 있는 조건: 있고 + 아직 안 보냈고 + 꽉 안 찼음
    if (existing && !existing.hasDispatched && existing.keys.length < this.maxBatchSize) {
      return existing;
    }

    // 아니면 새 바구니를 만들고, "나중에 보내기"를 예약한다
    const newBatch: Batch<K, V> = { hasDispatched: false, keys: [], callbacks: [] };
    this.batch = newBatch;
    // this.batch가 아니라 newBatch를 넘긴다 → 그 사이 바구니가 바뀌어도 "이" 바구니가 보내진다
    this.batchScheduleFn(() => this.dispatchBatch(newBatch));
    return newBatch;
  }

  // 바구니를 보낸다: batch 함수를 한 번 호출하고 결과를 각 Promise에 나눠 준다
  private dispatchBatch(batch: Batch<K, V>) {
    batch.hasDispatched = true;

    Promise.resolve()
      // Promise.resolve().then 안에서 부르는 이유:
      // batch 함수가 바로 throw해도 프로그램이 죽지 않고 아래 .catch로 가게 하려고
      .then(() => this.batchLoadFn(batch.keys))
      .then((results) => {
        // batch 함수가 규칙을 어겼으면 에러 (throw → .catch에서 전부 실패 처리)
        if (!isArrayLike(results)) {
          throw new TypeError(
            `DataLoader의 batch 함수는 배열을 resolve하는 Promise를 반환해야 합니다. 받은 값: ${String(results)}`,
          );
        }
        if (results.length !== batch.keys.length) {
          throw new TypeError(
            `batch 함수가 keys ${batch.keys.length}개에 대해 결과 ${results.length}개를 반환했습니다. ` +
              `keys: ${JSON.stringify(batch.keys)}`,
          );
        }

        // i번째 결과 → i번째 Promise. Error면 그 key만 실패
        for (let index = 0; index < results.length; index++) {
          const result = results[index];
          const { resolve, reject } = batch.callbacks[index];
          if (result instanceof Error) {
            reject(result);
          } else {
            resolve(result);
          }
        }
      })
      .catch((error) => {
        // 전체 실패: 캐시에서 지우고(다음에 다시 시도할 수 있게) 전부 실패 처리
        for (const key of batch.keys) {
          this.clear(key);
        }
        for (const { reject } of batch.callbacks) {
          reject(error);
        }
      });
  }

  // 여러 key를 한 번에 요청. 일부가 실패해도 전체가 실패하지 않고, 그 자리에 Error가 들어간다
  //   예) loadMany([1, 2, 3]) → [값1, Error, 값3]
  loadMany(keys: ArrayLike<K>): Promise<Array<V | Error>> {
    if (!isArrayLike(keys)) {
      throw new TypeError(
        `loader.loadMany()는 배열로 호출해야 합니다. 받은 값: ${String(keys)}`,
      );
    }
    const promises: Promise<V | Error>[] = [];
    for (let i = 0; i < keys.length; i++) {
      // .catch로 에러를 "값"으로 바꿔서 Promise.all이 실패하지 않게 한다
      promises.push(this.load(keys[i]).catch((error) => error));
    }
    return Promise.all(promises);
  }

  // ── 캐시 조작 (캐시를 안 쓰면 아무것도 안 함) ──────────────────────────────
  // 전부 this를 반환 → loader.clear(1).prime(1, 새값) 처럼 이어 쓸 수 있다

  // key 하나를 캐시에서 지운다. 데이터를 수정한 뒤 옛 값이 나오지 않게 할 때 사용
  clear(key: K): this {
    this.cacheMap?.delete(this.getCacheKey(key));
    return this;
  }

  // 캐시를 전부 지운다
  clearAll(): this {
    this.cacheMap?.clear();
    return this;
  }

  // DB를 거치지 않고 캐시에 값을 직접 넣는다. 이미 있으면 덮어쓰지 않음
  //   덮어쓰려면: loader.clear(key).prime(key, value)
  prime(key: K, value: V | PromiseLike<V> | Error): this {
    const cacheMap = this.cacheMap;
    if (!cacheMap) {
      return this;
    }
    const cacheKey = this.getCacheKey(key);
    if (cacheMap.get(cacheKey) === undefined) {
      if (value instanceof Error) {
        const promise = Promise.reject(value);
        // 빈 .catch가 없으면 Node가 "처리 안 된 에러"로 보고 프로그램을 죽일 수 있다
        promise.catch(() => {});
        cacheMap.set(cacheKey, promise);
      } else {
        cacheMap.set(cacheKey, Promise.resolve(value));
      }
    }
    return this;
  }

  // 캐시에 쓸 key. 기본은 key 그대로, cacheKeyFn 옵션이 있으면 그걸로 변환
  //   예) { id: 1 } 객체는 매번 새 객체라 그대로는 캐시가 안 맞음 → JSON.stringify로 "{"id":1}" 문자열로
  private getCacheKey(key: K): C {
    return this.cacheKeyFn(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 옵션 검사 + 기본값
// ─────────────────────────────────────────────────────────────────────────────

// 기본 스케줄러: "지금 실행 중인 코드와 대기 중인 Promise 작업이 다 끝난 뒤"에 fn 실행
//   → 그동안 들어온 load들이 한 바구니에 모인다 (자세한 건 GUIDE Step 7)
function enqueuePostPromiseJob(fn: () => void) {
  Promise.resolve().then(() => process.nextTick(fn));
}

function getValidMaxBatchSize<K, V, C>(options?: Options<K, V, C>): number {
  if (options?.batch === false) {
    return 1; // 바구니에 1개씩 = 배칭 끄기
  }
  const maxBatchSize = options?.maxBatchSize;
  if (maxBatchSize === undefined) {
    return Infinity;
  }
  if (typeof maxBatchSize !== 'number' || maxBatchSize < 1) {
    throw new TypeError(`maxBatchSize는 1 이상의 숫자여야 합니다: ${String(maxBatchSize)}`);
  }
  return maxBatchSize;
}

function getValidBatchScheduleFn<K, V, C>(options?: Options<K, V, C>): (callback: () => void) => void {
  const batchScheduleFn = options?.batchScheduleFn;
  if (batchScheduleFn === undefined) {
    return enqueuePostPromiseJob;
  }
  if (typeof batchScheduleFn !== 'function') {
    throw new TypeError(`batchScheduleFn은 함수여야 합니다: ${String(batchScheduleFn)}`);
  }
  return batchScheduleFn;
}

function getValidCacheKeyFn<K, V, C>(options?: Options<K, V, C>): (key: K) => C {
  const cacheKeyFn = options?.cacheKeyFn;
  if (cacheKeyFn === undefined) {
    return (key) => key as unknown as C; // key 그대로 사용
  }
  if (typeof cacheKeyFn !== 'function') {
    throw new TypeError(`cacheKeyFn은 함수여야 합니다: ${String(cacheKeyFn)}`);
  }
  return cacheKeyFn;
}

function getValidCacheMap<K, V, C>(options?: Options<K, V, C>): CacheMap<C, Promise<V>> | null {
  if (options?.cache === false) {
    return null; // 캐시 안 씀
  }
  const cacheMap = options?.cacheMap;
  if (cacheMap === undefined) {
    return new Map();
  }
  // 직접 넘긴 캐시는 4개 메서드가 다 있는지 확인 (null이면 캐시 안 씀)
  if (cacheMap !== null) {
    const missing = (['get', 'set', 'delete', 'clear'] as const).filter(
      (fnName) => typeof cacheMap[fnName] !== 'function',
    );
    if (missing.length !== 0) {
      throw new TypeError(`cacheMap에 필요한 메서드가 없습니다: ${missing.join(', ')}`);
    }
  }
  return cacheMap;
}

// 배열처럼 length와 [0], [1]... 로 접근할 수 있는 값인지 확인
function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { length?: unknown }).length === 'number'
  );
}
