export type BatchLoadFn<K, V> = (
  keys: ReadonlyArray<K>,
) => PromiseLike<ArrayLike<V | Error>>; // 특정 키에대한 에러를 표현하기 위해 V | Error 형태로 배열을 반환하


export interface CacheMap<K, V> { // 키 → Promise<V> 형태로 저장된다.
  get(key: K): V | undefined; // map.get(key) → key에 해당하는 value 반환. 없으면 undefined
  set(key: K, value: V): unknown; // map.set(key, value) → key, value 저장 (Java의 put)
  delete(key: K): unknown; // map.delete(key) → key 삭제
  clear(): unknown; // map.clear() → 전부 비우기 (clearAll()에서 사용)
}

// 생성자 두 번째 인자로 받는 옵션들
export interface Options<K, V, C = K> {
  batch?: boolean; // 기본 true
  maxBatchSize?: number; // 기본 Infinity
  batchScheduleFn?: (callback: () => void) => void;
  cache?: boolean; // 기본 true
  cacheKeyFn?: (key: K) => C; // 기본 key => key
  cacheMap?: CacheMap<C, Promise<V>> | null; // 기본 new Map()
  name?: string;
}
type Batch<K, V> = {
  hasDispatched: boolean;
  keys: K[];
  callbacks: Array<{ resolve: (value: V) => void; reject: (error: Error) => void }>;
};

export default class DataLoader<K, V, C = K> {
    private batchLoadFn: BatchLoadFn<K, V>;
    private batch: Batch<K, V> | null = null;
    private cacheMap: CacheMap<C, Promise<V>>;

  constructor(batchLoadFn: BatchLoadFn<K, V>, options?: Options<K, V, C>) {
    this.batchLoadFn = batchLoadFn;
    this.cacheMap = new Map();
    // TODO [Step6] options의 값들을 읽어서 필드에 저장 (없으면 기본값)
  }

  load(key: K): Promise<V> {
   
    const cacheKey = this.getCacheKey(key);
    const cached = this.cacheMap.get(cacheKey);
    if (cached) {
      return cached;
    }

    if (!this.batch || this.batch.hasDispatched) {
      const newBatch: Batch<K, V> = { hasDispatched: false, keys: [], callbacks: [] };
      this.batch = newBatch;
      Promise.resolve().then(() => process.nextTick(() => this.dispatchBatch(newBatch)));
    }
    const batch = this.batch;

    const promise = new Promise<V>((resolve, reject) => {
      batch.keys.push(key);
      batch.callbacks.push({ resolve, reject });
    });
    this.cacheMap.set(cacheKey, promise);
    return promise;
  }

  private dispatchBatch(batch: Batch<K, V>) {
    batch.hasDispatched = true;
    Promise.resolve()
      .then(() => this.batchLoadFn(batch.keys))
      .then((results) => {
    
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
        // ↑ throw하면 아래 .catch로 가서 전부 reject된다 (reject 코드를 두 번 쓸 필요 없음)

        // 결과물을 순서에 맞게 각 Promise의 resolve/reject에 전달
        // (results는 ArrayLike라서 forEach가 없음 → index 반복문 사용)
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
        for (const key of batch.keys) {
          this.clear(key);
        }
        for (const { reject } of batch.callbacks) {
          reject(error);
        }
      });
  }

  loadMany(keys: ArrayLike<K>): Promise<Array<V | Error>> {
    // ❌ 내가 쓴 코드: 인자 검사 없음
    // 왜 틀렸나: loadMany(1)처럼 배열이 아닌 값을 넘기면 keys.length가 undefined라
    //           에러 없이 빈 배열 []이 나와서 실수를 알아채기 어렵다
    // ✅ 정답: 배열이 아니면 바로 TypeError
    if (!isArrayLike(keys)) {
      throw new TypeError(
        `loader.loadMany()는 배열로 호출해야 합니다. 받은 값: ${String(keys)}`,
      );
    }
    const promises: Promise<V | Error>[] = [];
    // keys는 ArrayLike라서 for...of를 못 씀 → index 반복문 사용
    for (let i = 0; i < keys.length; i++) {
      promises.push(this.load(keys[i]).catch((error) => error));
    }
    return Promise.all(promises);
  }

  clear(key: K): this {
    this.cacheMap.delete(this.getCacheKey(key));
    return this;
  }

  clearAll(): this {
    this.cacheMap.clear();
    return this;
  }

  prime(key: K, value: V | PromiseLike<V> | Error): this {
    const cacheKey = this.getCacheKey(key);
    if (this.cacheMap.get(cacheKey) === undefined) {
      if (value instanceof Error) {
        const promise = Promise.reject(value);
        promise.catch(() => {});
        this.cacheMap.set(cacheKey, promise);
      } else {
        this.cacheMap.set(cacheKey, Promise.resolve(value));
      }
    }
    return this;
  }

  private getCacheKey(key: K): C {
    return key as unknown as C;
  }
}

// 배열처럼 length와 [i]로 접근할 수 있는 값인지 확인 (배열, arguments 등)
function isArrayLike(value: unknown): value is ArrayLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { length?: unknown }).length === 'number'
  );
}
