import {
  Args,
  Context,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { Loaders } from '../loader/loaders.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { User } from '../user/user.model.js';
import { Comment } from '../comment/comment.model.js';
import { Post } from './post.model.js';
import { PostService } from './post.service.js';
import { UpdatePostInput } from './dto/update-post.input.js';
import { CreatePostInput } from './dto/create-post.input.js';

@Resolver(() => Post)

export class PostResolver {
  constructor(
    private readonly postService: PostService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Mutation(() => Post)
  // ↑ GraphQL Mutation 필드 등록. 반환 타입은 생성된 Post (Post!)
  //   → 클라이언트는 생성 직후 id, createdAt 같은 서버가 만든 값을 바로 받아볼 수 있다.
  createPost(
    @Args('input') input: CreatePostInput,
    // ↑ GraphQL 인자 이름 "input". 타입은 TS 클래스(CreatePostInput)를 보고 자동 추론.
    //   (클래스 타입은 런타임에도 남아있어서 () => CreatePostInput 생략 가능.
    //    number와 달리 Int/Float 모호함도 없음)
  ) {
    return this.postService.create(input);
  }

  @Mutation(() => Post)
  updatePost(
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: UpdatePostInput,
    // ↑ 인자 2개 → updatePost(id: Int!, input: UpdatePostInput!)
  ) {
    return this.postService.update(id, input);
  }

  @Mutation(() => Boolean)
  // ↑ GraphQL의 Boolean 타입 (JS의 Boolean 생성자를 그대로 넘김)
  deletePost(@Args('id', { type: () => Int }) id: number) {
    return this.postService.remove(id);
  }

@ResolveField(() => User)
author(
  @Parent() post: Post,
  @Context('loaders') loaders: Loaders,
  // ↑ @Context('loaders'): app.module에서 만든 context 객체의 loaders 속성을 꺼낸다.
) {
  return loaders.userById.load(post.authorId);
  // ↑ 전: this.prisma.user.findFirst({ where: { id: post.authorId } })  → 즉시 SQL
  //   후: load()는 SQL을 바로 실행하지 않고 key(authorId)를 "등록"만 한다.
  //       같은 틱의 load()들이 다 모이면 batch 함수가 한 번에 처리하고,
  //       각 load()가 반환한 Promise가 자기 결과로 resolve된다.
}

  @ResolveField(() => [Comment])
  comments(@Parent() post: Post, @Context('loaders') loaders: Loaders) {
    // 글 id를 등록 → 같은 틱의 글들을 모아 postId IN (...) 1번으로 조회
    return loaders.commentsByPostId.load(post.id);
  }
}
