import type RealDataLoader from 'dataloader';

// IMPL=real 이면 진짜 dataloader 패키지, 아니면 내 구현을 사용한다.
// 타입은 진짜 패키지 기준으로 고정한다. (내 구현의 타입 검사는 `npm run typecheck`로)
const mod: { default: unknown } =
  process.env.IMPL === 'real'
    ? await import('dataloader')
    : await import('../dataloader/dataloader.js');

export default mod.default as typeof RealDataLoader;
