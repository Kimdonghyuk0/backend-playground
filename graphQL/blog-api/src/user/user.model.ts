// ─────────────────────────────────────────────────────────────────────────────
// User (GraphQL ObjectType)
// ─────────────────────────────────────────────────────────────────────────────
// "클라이언트가 GraphQL로 조회할 수 있는 User의 모양"을 정의한다.
//
// ⚠️ Prisma의 User 타입과는 다른 것!
//   - Prisma User   : DB 테이블 모양 (schema.prisma → 자동 생성)
//   - GraphQL User  : API로 "공개할" 모양 (여기서 직접 정의)
//   대부분 같지만, 예를 들어 password 같은 필드는 DB엔 있어도 GraphQL엔 안 넣는다.
//   → @Field()를 붙인 것만 API에 노출됨.
//
// 이 클래스는 아래 GraphQL 타입으로 변환된다 (src/schema.gql에서 확인 가능):
//   type User { !-> not null
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
  // ↑ GraphQL 필드로 노출. `() => Int`는 GraphQL 타입을 명시하는 부분.
  //   왜 명시해야 하나?
  //   → TypeScript의 number는 GraphQL에서 Int(정수)인지 Float(실수)인지 구분이 안 됨.
  //     안 적으면 기본값 Float이 된다. id는 정수니까 Int로 명시.
  //   ID 타입 vs Int 타입?
  //   → GraphQL의 ID는 "문자열로 직렬화되는 고유값"(응답에 "1"처럼 따옴표로 나감).
  //     Prisma id가 Int라서 이번 실습은 Int로 통일하는 게 덜 헷갈림.
  id: number;

  @Field()
  // ↑ string, boolean은 TS 타입만 보고 String, Boolean으로 자동 추론되므로 생략 가능.
  //   (tsconfig의 emitDecoratorMetadata: true 덕분에 런타임에 타입 정보를 읽을 수 있음)
  email: string;

  @Field()
  name: string;

  @Field()
  // ↑ Date 타입은 자동으로 GraphQL의 DateTime 스칼라가 된다.
  //   응답에는 "2026-10-12T07:32:11.970Z" 같은 ISO 문자열로 나간다.
  createdAt: Date;


}
