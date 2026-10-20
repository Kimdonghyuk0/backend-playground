class DataLoader {
    constructor(batchFn, options) {
        this.batchFn = batchFn;
        this.options = options;
        this.cacheMap = new Map();
        this.batch = null;
    }

    load(key) {
        var batch = getCurrentBatch(this);
        var cacheMap = this.cacheMap;
        var cachedPromise = cacheMap.get(key);

        if (cachedPromise) {
            var cacheHits = batch.cacheHits || (batch.cacheHits = []); // 디스패처때 실행될 함수목록

            return new Promise(function (resolve) {
                cacheHits.push(function () {
                    resolve(cachedPromise);
                });
            });
        }

        batch.keys.push(key);

        var promise = new Promise(function (resolve, reject) {
            batch.callbacks.push({
                resolve,
                reject
            });
        });

        cacheMap.set(key, promise);

        return promise;
    }
}

function getCurrentBatch(loader: DataLoader) {
    var batch = loader.batch;
    if(batch&&!hasDispatched)return batch;
    var newBatch = {
        hasDispatched: false,
        keys: [],
        callbacks: []
    }
    loader.batch = newBatch;
    Promise.resolve().then(function(){
        process.nextTick(function(){
            dispatchLoad(loader,newBatch);
        })
    })
    return newBatch
}

function dispatchLoad(loader: DataLoader, batch: Batch) {
    batch.hasDispatched = true;
     // 캐시 hit였던 요청들 resolve시켜주기
    if (batch.cacheHits) {
        for (var i = 0; i < batch.cacheHits.length; i++) {
            batch.cacheHits[i]();
        }
    }
    var batchFn = loader.batchFn;
    var promise = batchFn(batch.keys);
    promise.then(function(values){
        for(var i = 0; i<values.length; i++){
            batch.callbacks[i].resolve(values[i]);
        }
    })

}