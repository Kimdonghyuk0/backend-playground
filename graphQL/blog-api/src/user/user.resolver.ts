// ─────────────────────────────────────────────────────────────────────────────
// UserResolver
// ─────────────────────────────────────────────────────────────────────────────
// GraphQL의 Query/Mutation "필드"를 실제 함수와 연결하는 곳.
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
//   지금은 없어도 동작하지만, Step 4에서 @ResolveField(User의 posts 필드 등)를 쓸 때
//   "어느 타입의 필드인지" 알아야 해서 필요해진다. 미리 붙여두는 게 관례.
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => [User])
  // ↑ GraphQL 반환 타입: [User!]!
  //   - [User] : 배열. TS의 User[]를 GraphQL은 런타임에 알 수 없어서 () => [User]로 명시해야 함.
  //   - 바깥 ! : 배열 자체는 null 아님 (데이터가 없으면 빈 배열 [])
  //   - 안쪽 ! : 배열 안 요소도 null 아님
  //   메서드 이름 users → Query 필드 이름 users
  users() {
    return this.userService.findAll();
  }
// 유저객체를 반환하면 GraphQL엔진이 필요한 필드만 골라서 반환한다. 
  @Query(() => User, { nullable: true })
  // ↑ 반환 타입: User (느낌표 없음 = null 가능
    //   nullable: true : "찾는 id가 없으면 null 반환"을 GraphQL에 알려줌.
  user(
    @Args('id', { type: () => Int }) id: number,
    // ↑ @Args('id') : GraphQL 인자 "id"를 이 파라미터로 받는다. → user(id: Int!)
    //   type: () => Int : 이것도 number → Int 명시. 안 하면 Float이 돼서
    //   클라이언트가 user(id: 1) 로 보내도 타
    //   인자는 기본이 필수(!). 선택 인자는 { n
  ) {
    return this.userService.findOne(id);
  }
}