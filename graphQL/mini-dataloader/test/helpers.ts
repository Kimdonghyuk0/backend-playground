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
