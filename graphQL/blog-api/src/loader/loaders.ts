import DataLoader from 'dataloader';
import type { Comment, Post, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// 제네릭 로더 헬퍼 (Step 6)
// ─────────────────────────────────────────────────────────────────────────────
// 전: 로더 3개가 batch 함수를 각자 통째로 들고 있었다.
//   - userById               : findMany(id IN) → Map으로 정렬 → 없으면 null
//   - postsByAuthorId        : findMany(authorId IN) → authorId별 그룹핑 → 없으면 []
//   - commentsByPostId       : findMany(postId IN)   → postId별 그룹핑   → 없으면 []
//   → 아래 두 개는 테이블/외래키 이름만 다르고 코드가 똑같았다.
//
// 후: 반복되는 "패턴"을 헬퍼 2개로 뽑았다.
//   - createByIdLoader   : 1:1 (id로 하나)
//   - createGroupedLoader: 1:N (외래키로 묶어서 목록)
//   → batch 함수 규칙(① keys와 같은 순서 ② 없는 key 채우기)이 헬퍼 안에 한 번만 있다.
//   → 로더를 새로 만들 때 규칙을 실수할 곳이 없어진다.
//
// 💡 Prisma 모델(prisma.user)을 직접 제네릭으로 받지 않고 "조회 함수(fetch)"를 받는 이유:
//    Prisma delegate는 모델마다 타입이 달라서 제네릭으로 묶으면 타입이 매우 복잡해진다.
//    함수를 받으면 타입이 단순하고, Prisma가 아닌 데이터 소스(외부 API 등)에도 쓸 수 있다.
//    (Spring으로 치면 Strategy 객체를 주입받는 것과 비슷)

// 1:1 로더: key(id) 하나 → 값 하나 (없으면 null)
function createByIdLoader<T extends { id: number }>(
  fetch: (ids: number[]) => Promise<T[]>,
  // ↑ "id 목록을 받아 행 목록을 돌려주는 함수"만 넘기면 된다. (SQL 1번)
) {
  return new DataLoader<number, T | null>(async (ids) => {
    const rows = await fetch([...ids]);
    // ↑ ids는 readonly 배열이라 [...ids]로 복사해서 넘긴다.

    const rowById = new Map(rows.map((row) => [row.id, row]));
    return ids.map((id) => rowById.get(id) ?? null);
    // ↑ 규칙 ①: DB는 순서를 보장하지 않으니 Map으로 keys 순서에 맞춰 다시 정렬
    //   규칙 ②: 없는 id는 null로 채워서 길이를 keys와 똑같이 맞춘다
  });
}

// 1:N 로더: key(외래키 값) 하나 → 값 목록 (없으면 [])
function createGroupedLoader<T>(
  fetch: (keys: number[]) => Promise<T[]>,
  groupKey: (row: T) => number,
  // ↑ "이 행이 어느 key 그룹에 속하는지" 알려 주는 함수. 예: (post) => post.authorId
) {
  return new DataLoader<number, T[]>(async (keys) => {
    const rows = await fetch([...keys]);

    const rowsByKey = new Map<number, T[]>();
    for (const row of rows) {
      const k = groupKey(row);
      const list = rowsByKey.get(k) ?? [];
      list.push(row);
      rowsByKey.set(k, list);
    }
    // ↑ { 1 → [글1, 글2, ...], 2 → [글6, ...], ... }

    return keys.map((k) => rowsByKey.get(k) ?? []);
    // ↑ 규칙 ①②: keys 순서대로, 없는 key는 null이 아니라 빈 배열 []
    //   (GraphQL 타입이 [Post!]! / [Comment!]! 라서 null이면 에러)
  });
}

export function createLoader(prisma: PrismaService) {
  return {
    // Post.author, Comment.author에서 사용
    userById: createByIdLoader<User>((ids) =>
      prisma.user.findMany({ where: { id: { in: ids } } }),
    ),

    // User.posts에서 사용
    postsByAuthorId: createGroupedLoader<Post>(
      (authorIds) =>
        prisma.post.findMany({ where: { authorId: { in: authorIds } } }),
      (post) => post.authorId,
    ),

    // Post.comments에서 사용
    commentsByPostId: createGroupedLoader<Comment>(
      (postIds) =>
        prisma.comment.findMany({ where: { postId: { in: postIds } } }),
      (comment) => comment.postId,
    ),
    // ↑ 로더 추가가 "설정 몇 줄"이 됐다.
    //   예) postById가 필요하면:
    //       postById: createByIdLoader<Post>((ids) => prisma.post.findMany({ where: { id: { in: ids } } })),
  };
}

export type Loaders = ReturnType<typeof createLoader>;
// ↑ 반환 타입은 전과 똑같다 (DataLoader<number, User | null>, DataLoader<number, Post[]> ...)
//   → resolver, @Loaders() 데코레이터, clear()/prime() 코드는 하나도 안 바꿔도 된다.
