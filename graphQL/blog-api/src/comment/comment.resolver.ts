import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
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
  author(@Parent() comment: Comment) {
    // ↑ comment = Post.comments resolver가 반환한 댓글 객체 "하나".
    //   댓글이 150개면 이 함수가 150번 호출된다 → SQL 150번 (N+1의 N)
    return this.prisma.user.findFirst({ where: { id: comment.authorId } });
    // ↑ ⚠️ findUnique가 아니라 findFirst!
    //   Prisma는 같은 시점에 호출된 findUnique들을 몰래 하나로 합쳐버려서
    //   N+1이 눈에 안 보인다. 문제를 "재현"하려고 일부러 findFirst 사용.
    //   (Step 7에서 findUnique로 바꿔서 비교해볼 예정)
  }
}
