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
  author(@Parent() post: Post) {
    return this.prisma.user.findFirst({ where: { id: post.authorId } });
  }

  @ResolveField(() => [Comment])
  comments(@Parent() post: Post) { 
    return this.prisma.comment.findMany({ where: { postId: post.id } });
  }
}
