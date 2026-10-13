// ─────────────────────────────────────────────────────────────────────────────
// UserResolver
// ─────────────────────────────────────────────────────────────────────────────
// GraphQL의 Query/Mutation "필드"를 실제 함수와 연결하는 곳. (REST의 Controller 역할)
// 여기 @Query로 등록한 메서드 이름이 그대로 GraphQL Query 필드가 된다:
//   type Query {
//     users: [User!]!
//     user(id: Int!): User
//   }
// ─────────────────────────────────────────────────────────────────────────────
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { User } from './user.model.js';
import { UserService } from './user.service.js';

@Resolver(() => User)
// ↑ "이 resolver는 User 타입을 담당한다"는 표시.
//   Step 4에서 @ResolveField(User의 posts 필드 등)를 쓸 때 필요해진다.
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => [User])
  // ↑ 반환 타입: [User!]!
  //   - TS의 User[]는 런타임에 타입 정보가 사라져서 () => [User]로 명시해야 함.
  //   - 배열 자체도, 배열 안 요소도 null 아님 (데이터가 없으면 빈 배열 [])
  users() {
    return this.userService.findAll();
  }

  @Query(() => User, { nullable: true })
  // ↑ 반환 타입: User (느낌표 없음 = null 가능)
  //   ⭐ nullable: true가 없으면 없는 id 조회 시
  //   "Cannot return null for non-nullable field Query.user." 에러.
  user(
    @Args('id', { type: () => Int }) id: number,
    // ↑ GraphQL 인자 "id"를 받는다 → user(id: Int!)
    //   type: () => Int 를 안 적으면 Float이 됨.
  ) {
    return this.userService.findOne(id);
  }
}
