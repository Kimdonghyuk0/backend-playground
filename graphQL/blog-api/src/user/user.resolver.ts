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


import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service.js';
import { Post } from '../post/post.model.js';
import { Loaders } from '../loader/loaders.decorator.js';
import { User } from './user.model.js';
import { UserService } from './user.service.js';
import { CreateUserInput } from './dto/create-user.input.js';

@Resolver(() => User)
// ↑ "이 resolver는 User 타입을 담당한다"는 표시.
//   지금은 없어도 동작하지만, Step 4에서 @ResolveField(User의 posts 필드 등)를 쓸 때
//   "어느 타입의 필드인지" 알아야 해서 필요해진다. 미리 붙여두는 게 관례.
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Mutation(() => User)
  async createUser(
    @Args('input') input: CreateUserInput,
    @Loaders() loaders: Loaders,
  ) {
    // 전: return this.userService.create(input);
    //   → 같은 요청에서 userById.load(새 유저 id)가 호출되면 SQL이 1번 더 나간다.
    //     (방금 만든 유저 객체를 이미 손에 들고 있는데도!)
    const user = await this.userService.create(input);
    loaders.userById.prime(user.id, user);
    // ↑ prime(key, value): 캐시에 값을 "미리 넣어" 둔다.
    //   이후 같은 요청에서 userById.load(user.id) → DB 안 가고 캐시에서 바로 반환.
    //   clear()가 "틀린 캐시를 지우는 것"이라면, prime()은 "맞는 값을 미리 채우는 것".
    //   ⚠️ prime()은 key가 이미 캐시에 있으면 덮어쓰지 않는다.
    //      값을 교체하려면 loaders.userById.clear(id).prime(id, newValue) 처럼 지우고 넣기.

    return user;
  }

  @ResolveField(() => [Post])
  posts(@Parent() user: User, @Loaders() loaders: Loaders) {
    // 유저 id를 등록 → 같은 틱의 유저들을 모아 authorId IN (...) 1번으로 조회
    return loaders.postsByAuthorId.load(user.id);
  }
}
