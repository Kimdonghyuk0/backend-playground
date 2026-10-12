import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient();

const USER_COUNT = 10;
const POSTS_PER_USER = 5;
const COMMENTS_PER_POST = 3;

async function main() {
  // 기존 데이터 삭제 (FK 때문에 Comment → Post → User 순서)
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.user.deleteMany();

  // AUTOINCREMENT 초기화 → 다시 seed해도 id가 항상 1부터 시작
  await prisma.$executeRawUnsafe(
    `DELETE FROM sqlite_sequence WHERE name IN ('User', 'Post', 'Comment')`,
  );

  const users = await prisma.user.createManyAndReturn({
    data: Array.from({ length: USER_COUNT }, (_, i) => ({
      email: `user${i + 1}@example.com`,
      name: `User ${i + 1}`,
    })),
  });

  const posts = await prisma.post.createManyAndReturn({
    data: users.flatMap((user) =>
      Array.from({ length: POSTS_PER_USER }, (_, j) => ({
        title: `${user.name}의 글 ${j + 1}`,
        content: `${user.name}가 작성한 ${j + 1}번째 글입니다.`,
        published: j % 2 === 0,
        authorId: user.id,
      })),
    ),
  });

  // 댓글 작성자를 여러 유저로 돌아가며 지정 → Comment.author N+1 확인용
  const comments = await prisma.comment.createMany({
    data: posts.flatMap((post, p) =>
      Array.from({ length: COMMENTS_PER_POST }, (_, k) => {
        const commenter = users[(p + k + 1) % users.length];
        return {
          content: `${commenter.name}의 댓글 ${k + 1}`,
          postId: post.id,
          authorId: commenter.id,
        };
      }),
    ),
  });

  console.log(
    `Seed 완료: User ${users.length}, Post ${posts.length}, Comment ${comments.count}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
