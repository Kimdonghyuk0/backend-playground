function DataLoader(batchFn, options) {
  this.batchFn = batchFn;
  this.options = options;
  this.batch = null;
  this.cacheMap = new Map();
}
DataLoader.prototype.load = load; // 이래야 데이터로더 모든객체가 로드함수를 사용할 수 있음
function load(key) {
  var batch = getCurrentBatch(this);
  var cacheMap = this.cacheMap;

  var cachedPromise = cacheMap.get(key);

  if (cachedPromise) {
    return Promise.resolve(cachedPromise);
  }

  batch.keys.push(key);

  var promise = new Promise(function (resolve, reject) {
    batch.callbacks.push({
      resolve: resolve,
      reject: reject
    });
  });

  cacheMap.set(key, promise);

  return promise;
}

function getCurrentBatch(loader) {
  var batch = loader.batch;

  // 아직 dispatch 안 된 배치만 재사용
  if (batch && !batch.hasDispatched) {
    return batch;
  }

  var newBatch = {
    hasDispatched: false,
    keys: [],
    callbacks: []
  };

  loader.batch = newBatch;

  // dispatch 예약
  Promise.resolve().then(function () {
    process.nextTick(function () {
      dispatchBatch(loader, newBatch); // ★ batch 말고 newBatch
    });
  });

  return newBatch;
}

function dispatchBatch(loader, batch) {
  batch.hasDispatched = true;

  var batchLoadFn = loader.batchFn;

  // ★ 여기서 사용자가 넘긴 batchFn 실제 실행
  var batchPromise = batchLoadFn(batch.keys);

  batchPromise.then(function (values) {
    for (var i = 0; i < values.length; i++) {
      batch.callbacks[i].resolve(values[i]);
    }
  });
}