class DataLoader{
    constructor(batchFn, options){
        this.batchFn = batchFn;
        this.options = options;
        this.cacheMap = new Map();
        this.batch = null;
    }


    load(key){
        var batch = getCurrentBatch(this);
        var cacheHits = batch.cacheHits||(cacheHits=[]);
        var cacheHitPromise = cacheHits.get(key);
        if(cacheHitPromise){
            //캐시히트
            return new Promise(function(resolve){
                cacheHits.push(function(){
                    resolve(cacheHitPromise);
                })
            })
        }
        batch.keys.push(key);
        var promise = new Promise(function(resolve,reject){
            batch.callbacks.push({resolve,reject });
        })
        return promise;
        

    }

    getCurrentBatch(loader:DataLoader){
        var batch = this.batch;
        if(batch&&!batch.hasDispatched)return batch;

        var newBatch = {
            hasDispatch : false,
            keys: [],
            callbacks: []
        }
        //예약하고 리턴
        Promise.resolve().then(function(){
            process.nextTick(loadDispatch());
        })

        return newBatch;

    }

    loadDispatch(loader:DataLoader, bathch:Batch){ // 실행만 시키면 됨
        var batchFn = batch.BahchFn;
        batch.hasDispatch = true;
        var promise = batchFn(batch.keys);
        promise.then(function(values){
            if(cacheHits){
                for(var i = 0; i<cacheHits.length; i++){
                    cacheHits[i];
                }
            }
            // 캐시미스인 애들 전부 resolve에 담기
            for(var i = 0; i<value.length; i++){
                batch.callbacks[i].promise(value[i]);
            }
        })

    }




}