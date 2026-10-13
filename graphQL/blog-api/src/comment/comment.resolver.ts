import { Context, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { Loaders } from '../loader/loaders.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { User } from '../user/user.model.js';
import { Comment } from './comment.model.js';

@Resolver(() => Comment)
// ↑ Comment 타입 담당. 아직 Comment용 @Query는 없고, 필드(author)만 정의한다.
//   Comment 목록은 Post.comments를 통해서만 조회됨.
export class CommentResolver {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ 이번 단계는 Service를 거치지 않고 Prisma를 바로 쓴다.
  //   Step 5에서 이 부분을 DataLoader로 통째로 갈아끼울 거라, 지금은 단순하게.

  @ResolveField(() => User)
  // ↑ Comment 타입에 "author: User!" 필드 추가
  author(@Parent() comment: Comment, @Context('loaders') loaders: Loaders) {
    // 작성자 id를 등록 → Post.author와 같은 userById 로더를 공유해서 캐시도 같이 씀
    return loaders.userById.load(comment.authorId);
  }
}
