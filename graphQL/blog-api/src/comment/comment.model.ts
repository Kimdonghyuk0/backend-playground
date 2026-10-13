import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Comment {
  @Field(() => Int)
  id: number;

  @Field()
  content: string;

  @Field(() => Int)
  postId: number;

  @Field(() => Int)
  authorId: number;
  // ↑ Comment.author를 resolve할 때 "누구를 조회할지" 이 값으로 찾는다.

  @Field()
  createdAt: Date;
}
