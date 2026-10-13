
// ─────────────────────────────────────────────────────────────────────────────
// UpdatePostInput
// ─────────────────────────────────────────────────────────────────────────────
// 수정할 때는 "바꾸고 싶은 필드만" 보내고 싶다.
//   updatePost(id: 1, input: { title: "새 제목" })   ← title만 수정
//
// CreatePostInput의 필드를 복사해서 전부 선택(nullable)으로 바꾼 클래스가 필요한데,
// 직접 다시 쓰지 않고 "Mapped Types" 유틸로 만든다.
//
// 결과 (schema.gql):
//   input UpdatePostInput {
//     title: String          ← 전부 느낌표 없음 (선택)
//     content: String
//     published: Boolean
//                           ← authorId는 없음 (작성자는 바꿀 수 없게)
//   }
// ─────────────────────────────────────────────────────────────────────────────
import { InputType, OmitType, PartialType } from '@nestjs/graphql';
// ↑ ⚠️ '@nestjs/mapped-types'가 아니라 '@nestjs/graphql'에서 가져와야 한다!
//   graphql 버전은 TS 타입뿐 아니라 @Field() 메타데이터(GraphQL 스키마 정보)까지 같이 복사해준다.
import { CreatePostInput } from './create-post.input.js';

@InputType()
export class UpdatePostInput extends PartialType(
  // ↑ PartialType(X): X의 모든 필드를 "선택"으로 바꾼 새 클래스를 만든다.
  //   TS의 Partial<X>와 같은 개념인데, GraphQL 스키마까지 nullable로 바꿔준다.
  OmitType(CreatePostInput, ['authorId'] as const),
  // ↑ OmitType(X, [키들]): X에서 특정 필드를 "뺀" 클래스를 만든다. (TS의 Omit<X, K>)
  //   여기서는 작성자(authorId)는 수정 못 하게 뺐다.
  //   as const: 배열을 ['authorId'] 리터럴 타입으로 고정해서 TS가 정확한 키를 알게 함.
  //
  //   실행 순서: CreatePostInput → (authorId 제거) → (전부 선택으로) → UpdatePostInput
) {}
// ↑ 클래스 본문이 비어 있어도 필드는 전부 상속받아 들어있다.
//   Mapped Types 종류: PartialType, PickType, OmitType, IntersectionType