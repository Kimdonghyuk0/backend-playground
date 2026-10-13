// ─────────────────────────────────────────────────────────────────────────────
// CreatePostInput (GraphQL InputType)
// ─────────────────────────────────────────────────────────────────────────────
// createPost Mutation이 "받는" 입력값의 모양.
// 아래 GraphQL input 타입으로 변환된다 (schema.gql에서 확인):
//   input CreatePostInput {
//     title: String!
//     content: String!
//     published: Boolean      ← 느낌표 없음 = 안 보내도 됨
//     authorId: Int!
//   }
//
// 💡 id, createdAt이 없는 이유:
//    둘 다 DB가 자동으로 채우는 값이라 (@default(autoincrement()), @default(now()))
//    클라이언트가 보낼 필요가 없고, 보내게 해서도 안 된다.
//
// 💡 파일 이름의 dto = Data Transfer Object. "계층 간에 데이터를 옮기는 객체"라는 뜻.
//    Nest에서는 입력값 클래스를 dto 폴더에 두는 게 관례.
// ────────────────────────────────────────────────────
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
// ↑ "이 클래스는 GraphQL의 input 타입이다" 라
//   @ObjectType()과 쓰는 법은 똑같지만, 응답이있다.
export class CreatePostInput {
  @Field()
  title: string;

  @Field()
  content: string;

  @Field({ nullable: true })
  // ↑ 선택 입력. 클라이언트가 안 보내면 undefi
  //   → Prisma는 undefined인 필드를 "없는 것"으로 취급해서
  //     schema.prisma의 @default(false)가 적용된다.
  published?: boolean;
  // ↑ TS에서도 ?를 붙여서 "없을 수 있다"는 걸

  @Field(() => Int)
  // ↑ number → Int 명시 (안 하면 Float)
  authorId: number;
}