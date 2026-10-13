// ─────────────────────────────────────────────────────────────────────────────
// User (GraphQL ObjectType)
// ─────────────────────────────────────────────────────────────────────────────
// "클라이언트가 GraphQL로 조회할 수 있는 User의 모양"을 정의한다.
//
// ⚠️ Prisma의 User 타입과는 다른 것!
//   - Prisma User   : DB 테이블 모양 (schema.prisma → 자동 생성)
//   - GraphQL User  : API로 "공개할" 모양 (여기서 직접 정의)
//   @Field()를 붙인 것만 API에 노출된다. (예: password는 DB엔 있어도 여기엔 안 넣음)
//
// 이 클래스는 아래 GraphQL 타입으로 변환된다 (src/schema.gql에서 확인 가능):
//   type User {
//     id: Int!
//     email: String!
//     name: String!
//     createdAt: DateTime!
//   }
// ─────────────────────────────────────────────────────────────────────────────
import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
// ↑ "이 클래스는 GraphQL의 type(객체 타입)이다"라고 표시.
//   클래스 이름(User)이 그대로 GraphQL 타입 이름이 된다.
export class User {
  @Field(() => Int)
  // ↑ TS의 number는 GraphQL에서 Int인지 Float인지 구분이 안 됨.
  //   안 적으면 기본값 Float이 되므로, 정수인 id는 Int로 명시.
  id: number;

  @Field()
  // ↑ string, boolean은 TS 타입만 보고 String, Boolean으로 자동 추론 → 타입 생략 가능.
  //   (tsconfig의 emitDecoratorMetadata: true 덕분)
  email: string;

  @Field()
  name: string;

  @Field()
  // ↑ Date는 자동으로 GraphQL의 DateTime 스칼라가 된다.
  //   응답에는 "2026-10-12T07:32:11.970Z" 같은 ISO 문자열로 나간다.
  createdAt: Date;

  // ⚠️ 기본적으로 모든 필드는 non-null(!)이다.
  //   null이 올 수 있는 필드는 @Field({ nullable: true }) 로 표시해야 함.

  // 💡 posts 같은 관계 필드는 Step 4에서 추가한다.
}
