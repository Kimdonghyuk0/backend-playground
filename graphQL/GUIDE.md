# GraphQL + DataLoader 실습 가이드

NestJS + GraphQL(Apollo, code-first) + Prisma로 블로그 API를 만들고,
**N+1 문제를 직접 눈으로 확인한 뒤 DataLoader로 해결**하는 것이 목표입니다.

> 각 단계의 **완료 기준**을 만족하면 체크(`[x]`)하고 커밋하세요.
> 커밋 메시지 예: `graphql: step3 - post/comment relation resolver`

---

## 0. 준비

### 0-1. 환경 확인
- [ ] Node **20 이상** (22 LTS 추천). 지금 이 Mac은 `v18.20.8`이라 **업그레이드가 필요**합니다.
  - 최신 NestJS와 Prisma는 Node 18을 지원하지 않습니다.
  - `nvm install 22 && nvm use 22` 또는 `brew install node@22`
- [ ] Nest CLI: `npm i -g @nestjs/cli` (또는 매번 `npx @nestjs/cli`)

### 0-2. 프로젝트 생성
`practice` 루트가 이미 git 저장소이므로 **`--skip-git`을 꼭 붙이세요**.

```bash
cd ~/Desktop/practice/graphQL
nest new blog-api --skip-git --package-manager npm
cd blog-api
```

### 0-3. 패키지 설치
```bash
npm i @nestjs/graphql @nestjs/apollo @apollo/server graphql
npm i dataloader
npm i -D prisma
npm i @prisma/client
npx prisma init --datasource-provider sqlite
```

> Prisma는 메이저 버전마다 설정 방식(`prisma.config.ts`, generator, driver adapter 등)이 바뀝니다.
> 설치된 버전에 맞는 공식 문서(https://www.prisma.io/docs)의 **NestJS / SQLite Quickstart**를 따라가세요.

### 최종 폴더 구조 (목표)
```
graphQL/
├── GUIDE.md                 ← 이 파일
└── blog-api/
    ├── prisma/
    │   ├── schema.prisma
    │   └── seed.ts
    └── src/
        ├── app.module.ts
        ├── prisma/          # PrismaService, PrismaModule
        ├── user/            # user.model.ts, user.resolver.ts, user.service.ts
        ├── post/            # post.model.ts, post.resolver.ts, dto/
        ├── comment/
        └── loader/          # dataloader 관련 (step 5~)
```

---

## Step 1. Prisma 스키마와 시드 데이터

### 과제
- [ ] `schema.prisma`에 모델 3개 정의
  - `User` : id, email(unique), name, createdAt
  - `Post` : id, title, content, published(Boolean), authorId → User, createdAt
  - `Comment` : id, content, postId → Post, authorId → User, createdAt
- [ ] `npx prisma migrate dev --name init` 실행
- [ ] `prisma/seed.ts` 작성: **User 10명, 사람마다 Post 5개, Post마다 Comment 3개**
  - 데이터가 충분히 있어야 N+1이 눈에 띕니다 (Post 50개, Comment 150개).
- [ ] `PrismaService`(`PrismaClient` 상속 + `onModuleInit`에서 `$connect`)와 `PrismaModule`(`@Global`) 작성
- [ ] **쿼리 로그 켜기**: `new PrismaClient({ log: ['query'] })` 처럼 실행되는 SQL이 콘솔에 찍히게 설정

### 완료 기준
- `npx prisma studio`에서 데이터 확인
- 서버가 에러 없이 실행됨 (`PrismaModule dependencies initialized`)
- **쿼리를 실행했을 때** 콘솔에 `prisma:query SELECT ...` 로그가 출력됨
  (서버를 켜기만 해서는 SQL이 실행되지 않으므로 로그도 안 나옴. 아래 확인 방법 참고)

---

## Step 2. GraphQL 기본 세팅 + 단순 Query

### 과제
- [ ] `app.module.ts`에 `GraphQLModule.forRoot<ApolloDriverConfig>()` 등록
  - `driver: ApolloDriver`, `autoSchemaFile: true` (code-first)
- [ ] `@ObjectType()`로 `User`, `Post`, `Comment` 모델 클래스 작성
  - 이 단계에서는 **관계 필드(author, posts, comments)는 아직 넣지 않습니다**
- [ ] Query 구현
  - `users: [User!]!`
  - `user(id: Int!): User` (없으면 `null`)
  - `posts: [Post!]!`
  - `post(id: Int!): Post`

### 완료 기준
`http://localhost:3000/graphql`(Apollo Sandbox)에서 아래 쿼리가 동작해야 합니다.
```graphql
query {
  users { id name email }
  post(id: 1) { id title published }
}
```

### 생각해볼 것
- code-first와 schema-first의 차이는 무엇일까요? 자동 생성된 스키마를 확인해 보세요.
- `Int`와 `ID` 타입 중 무엇을 써야 할까요?

---

## Step 3. Mutation + Input 타입

### 과제
- [ ] `@InputType()`으로 DTO 작성: `CreateUserInput`, `CreatePostInput`, `UpdatePostInput`
- [ ] Mutation 구현
  - `createUser(input: CreateUserInput!): User!`
  - `createPost(input: CreatePostInput!): Post!`
  - `updatePost(id: Int!, input: UpdatePostInput!): Post!`
  - `deletePost(id: Int!): Boolean!`
- [ ] 존재하지 않는 id를 수정하거나 삭제하면 GraphQL 에러를 반환
- [ ] (선택) `class-validator`와 `ValidationPipe`로 입력값 검증 (예: email 형식, title 길이)

### 완료 기준
- Sandbox에서 생성, 수정, 삭제가 모두 동작
- 잘못된 요청에 대해 `errors` 배열에 의미 있는 메시지가 나옴

---

## Step 4. 관계 필드와 N+1 문제 재현 ⚠️ 핵심

### 과제
- [ ] 모델에 관계 필드 추가
  - `Post.author: User!`
  - `Post.comments: [Comment!]!`
  - `User.posts: [Post!]!`
  - `Comment.author: User!`
- [ ] `@ResolveField()` + `@Parent()`로 **각 필드를 단순하게** 구현
  ```ts
  @ResolveField(() => User)
  author(@Parent() post: Post) {
    return this.prisma.user.findFirst({ where: { id: post.authorId } });
  }
  ```
  > ⚠️ 여기서 `findUnique`가 아니라 **`findFirst`를 쓰세요.**
  > Prisma는 같은 틱에 호출된 `findUnique`를 내부에서 자동으로 묶어 실행합니다.
  > 그래서 `findUnique`로는 N+1이 잘 드러나지 않습니다. 이 내용은 Step 7에서 확인합니다.

- [ ] 아래 쿼리를 실행하고 **콘솔에 찍힌 SQL 개수를 세서 기록**하세요
  ```graphql
  query {
    posts {
      title
      author { name }
      comments {
        content
        author { name }
      }
    }
  }
  ```

### 기록표 (직접 채우기)
| 쿼리 | 예상 SQL 수 | 실제 SQL 수 |
|---|---|---|
| `posts { title }` | 1 | |
| `posts { author { name } }` | 1 + 50 | |
| `posts { comments { author { name } } }` | | |

### 완료 기준
- 왜 SQL이 `1 + N + N×M`개 실행되는지 **본인 말로 설명**할 수 있어야 합니다.
  (GraphQL은 필드마다 resolver를 따로 실행한다는 점이 핵심입니다)

> 💡 SQL 개수를 쉽게 세는 방법: Prisma `$on('query')` 이벤트나 `$extends`로 요청마다 카운터를 올리고,
> 응답 직전에 `console.log('SQL count:', n)`을 출력하는 간단한 Apollo plugin을 만들어 보세요. (선택 과제)

---

## Step 5. DataLoader로 N+1 해결 🎯 메인 목표

### 5-1. 개념 정리 (코드 작성 전에 먼저 답해보기)
- [ ] DataLoader의 **batching**이란? (같은 틱에 들어온 `load(key)` 호출을 모아서 한 번에 처리)
- [ ] DataLoader의 **caching**이란? (같은 요청 안에서 같은 key를 다시 조회하지 않음)
- [ ] 왜 DataLoader는 **요청(request)마다 새로 만들어야** 할까요?
  (전역 싱글톤으로 만들면 어떤 문제가 생길까요? 다른 사용자 데이터 노출, 오래된 캐시)

### 5-2. 구현 과제
- [ ] `src/loader/` 폴더에 로더 생성 함수 작성
  ```ts
  // loaders.ts
  export function createLoaders(prisma: PrismaService) {
    return {
      userById: new DataLoader<number, User | null>(async (ids) => { /* TODO */ }),
      postsByAuthorId: new DataLoader<number, Post[]>(async (authorIds) => { /* TODO */ }),
      commentsByPostId: new DataLoader<number, Comment[]>(async (postIds) => { /* TODO */ }),
    };
  }
  ```
- [ ] **batch 함수 규칙**을 지키기
  1. `findMany({ where: { id: { in: ids } } })`로 **쿼리 1번**에 조회
  2. 반환 배열의 **길이와 순서가 입력 keys와 정확히 같아야** 함 (`Map`으로 정렬)
  3. 없는 key는 `null`(1:1) 또는 `[]`(1:N)로 채우기
- [ ] **요청마다 로더 생성**: `GraphQLModule`의 `context`에서 생성
  ```ts
  GraphQLModule.forRootAsync<ApolloDriverConfig>({
    driver: ApolloDriver,
    imports: [LoaderModule],
    inject: [LoaderService],
    useFactory: (loaderService: LoaderService) => ({
      autoSchemaFile: true,
      context: () => ({ loaders: loaderService.create() }),
    }),
  })
  ```
- [ ] Step 4의 `@ResolveField`를 로더 호출로 교체
  ```ts
  @ResolveField(() => User)
  author(@Parent() post: Post, @Context('loaders') loaders: Loaders) {
    return loaders.userById.load(post.authorId);
  }
  ```

### 완료 기준
- [ ] Step 4와 **같은 쿼리**를 다시 실행하고 기록표 채우기

| 쿼리 | DataLoader 전 | DataLoader 후 |
|---|---|---|
| `posts { author { name } }` | | (목표: 2) |
| `posts { comments { author { name } } }` | | (목표: 4 이하) |

- [ ] 콘솔 SQL에서 `WHERE id IN (...)` 형태가 나오는지 확인

---

## Step 6. DataLoader 심화

- [ ] **캐시 무효화**: `updatePost`나 `createComment` 이후 같은 요청 안에서 다시 조회하면 어떻게 될까요?
  - `loader.clear(key)`와 `loader.prime(key, value)`를 사용해 보기
- [ ] **커스텀 데코레이터**: `@Loaders()` 파라미터 데코레이터를 만들어 `@Context('loaders')`를 대체
- [ ] **인자가 있는 관계 필드**: `User.posts(published: Boolean)`처럼 인자가 붙으면 key를 어떻게 설계할까요?
  - 힌트: key를 `{ authorId, published }` 객체로 만들고 `cacheKeyFn` 사용
- [ ] **제네릭 로더**: `createByIdLoader(model)` 같은 헬퍼로 로더 중복 코드 줄이기
- [ ] (선택) `Scope.REQUEST` provider로 로더를 주입하는 방식과 context 방식 비교하기
  - 장단점: DI 편의성과 성능(요청마다 provider 체인이 다시 생성됨)

---

## Step 7. 비교와 회고

- [ ] Step 4 코드를 `findFirst` 대신 `findUnique`로 바꾸고 SQL 수를 다시 세보기
  - Prisma가 자동으로 묶어주는 범위와 한계는 무엇일까요? (1:N 관계, `findMany`는 묶이지 않음)
- [ ] `include`로 미리 JOIN하는 방식(eager loading)과 DataLoader 방식 비교
  - 클라이언트가 `author`를 요청하지 않으면 어떤 방식이 손해일까요?
- [ ] 아래 질문에 답을 적어 이 파일 맨 아래 **회고** 섹션에 남기기
  1. N+1 문제란 무엇이고, GraphQL에서 특히 잘 생기는 이유는?
  2. DataLoader의 batch 함수가 지켜야 할 규칙 2가지는?
  3. DataLoader를 요청마다 만들어야 하는 이유는?
  4. DataLoader 말고 N+1을 해결하는 다른 방법은?

---

## 보너스 과제 (여유 있을 때)
- [ ] Cursor 기반 페이지네이션 (`posts(first: Int, after: String)` → Connection 타입)
- [ ] 쿼리 복잡도 및 depth 제한 (`graphql-depth-limit` 등)으로 악의적인 깊은 쿼리 막기
- [ ] e2e 테스트: `supertest`로 GraphQL 요청을 보내고 SQL 수 assertion
- [ ] Subscription: 댓글이 생성되면 실시간 알림 (`graphql-ws`)

---

## 참고 자료
- NestJS GraphQL: https://docs.nestjs.com/graphql/quick-start
- Prisma: https://www.prisma.io/docs
- DataLoader: https://github.com/graphql/dataloader
- Prisma Query 최적화 (N+1): https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance

---

## 회고
<!-- Step 7의 질문 답변을 여기에 작성 -->
