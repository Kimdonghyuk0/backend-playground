import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Post } from './post.model.js';
import { PostService } from './post.service.js';

@Resolver(() => Post)

export class PostResolver {
  constructor(private readonly postService: PostService) {}

  @Query(() => [Post])
  posts() {
    return this.postService.findAll();
  }

  @Query(() => Post, { nullable: true })
  post(
    @Args('id', { type: () => Int }) id: number,
  ) {
    return this.postService.findOne(id);
  }

  // userId로 Post를 조회하는 Query를 추가해보자.
  @Query(() => [Post])
  postsByUserId(
    @Args('userId', { type: () => Int }) userId: number,
  ) {
    return this.postService.findByUserId(userId);
  }
}