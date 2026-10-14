import {
  Args,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Loaders } from '../loader/loaders.decorator.js'; 
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
  async createPost(
    // ↑ async 추가: 글 생성을 "기다린 뒤" 캐시를 지워야 해서 await가 필요하다.
    @Args('input') input: CreatePostInput,
    // ↑ GraphQL 인자 이름 "input". 타입은 TS 클래스(CreatePostInput)를 보고 자동 추론.
    //   (클래스 타입은 런타임에도 남아있어서 () => CreatePostInput 생략 가능.
    //    number와 달리 Int/Float 모호함도 없음)
    @Loaders() loaders: Loaders,
    // ↑ 6-1에서 만든 데코레이터. 이 요청의 context에 있는 로더를 받는다.
  ) {
    // 전: return this.postService.create(input);
    //   → 글은 DB에 생기지만, postsByAuthorId 캐시에는 "글 생성 전 목록"이 남아 있다.
    //   → 같은 요청 안에서 author { posts }를 다시 조회하면 새 글이 빠진 목록이 나온다.
    const post = await this.postService.create(input);
    loaders.postsByAuthorId.clear(input.authorId);
    // ↑ 이 작성자의 "글 목록" 캐시가 이제 틀린 값이 됐으니 지운다.
    // ↑ clear(key): 이 key의 캐시만 지운다. (다른 작성자의 캐시는 그대로)
    //   다음 load(authorId) 호출은 캐시가 없으니 DB를 다시 조회 → 새 글이 포함된 목록.
    //   ⚠️ 반드시 create "후"에 지워야 한다.
    //      먼저 지우면, 생성이 끝나기 전에 다른 필드가 load()해서 옛 목록이 다시 캐시될 수 있다.

    return post;
  }

  @Mutation(() => Post)
  async updatePost(
    @Args('id', { type: () => Int }) id: number,
    @Args('input') input: UpdatePostInput,
    // ↑ 인자 2개 → updatePost(id: Int!, input: UpdatePostInput!)
    @Loaders() loaders: Loaders,
  ) {
    // 전: return this.postService.update(id, input);
    //   → postsByAuthorId 캐시에는 글 객체 자체(title, content, published)가 들어 있다.
    //   → 글을 수정해도 캐시 안의 글 객체는 "수정 전 내용"으로 남는다.
    //   → 같은 요청 안에서 author { posts { title } }를 다시 조회하면 옛 제목이 나온다.
    const updated = await this.postService.update(id, input);

    loaders.postsByAuthorId.clear(updated.authorId);
    // ↑ 수정된 글이 들어 있는 "작성자의 글 목록" 캐시를 지운다.
    //   authorId는 input이 아니라 update 결과(updated)에서 꺼낸다.
    //   (UpdatePostInput은 OmitType으로 authorId를 빼서, 작성자는 바뀌지 않음
    //    → 이전/새 작성자 2개를 지울 필요 없이 현재 작성자 1개만 지우면 된다.)
    //   prime()을 안 쓰는 이유: 우리가 가진 건 "글 1개"뿐이고, 캐시 값은 "글 목록 전체"라서
    //   정답 값을 모른다 → 지우고, 필요하면 DB에서 다시 조회하게 둔다.

    return updated;
  }

  @Mutation(() => Boolean)
  // ↑ GraphQL의 Boolean 타입 (JS의 Boolean 생성자를 그대로 넘김)
  async deletePost(
    @Args('id', { type: () => Int }) id: number,
    @Loaders() loaders: Loaders,
  ) {
    // 전: return this.postService.remove(id);  (true만 반환)
    //   → 삭제된 글이 postsByAuthorId 캐시의 목록에 그대로 남는다.
    //   → remove()가 댓글도 지우는데, commentsByPostId 캐시에는 댓글 목록이 남는다.
    //   → 그리고 true만 받아서는 "누구의 글이었는지(authorId)"를 알 수 없었다.
    const deleted = await this.postService.remove(id);
    // ↑ remove()가 삭제된 글을 반환하도록 바꿨다. → deleted.authorId를 쓸 수 있다.

    loaders.postsByAuthorId.clear(deleted.authorId);
    // ↑ 작성자의 글 목록에서 이 글이 빠져야 하므로 목록 캐시를 지운다.
    loaders.commentsByPostId.clear(id);
    // ↑ 이 글의 댓글도 DB에서 지워졌으니 댓글 목록 캐시도 지운다.
    //   (userById는 지우지 않는다: 유저 자체는 바뀐 게 없음)

    return true;
    // ↑ GraphQL 스키마는 그대로 deletePost: Boolean! (클라이언트 입장에선 변화 없음)
  }

@ResolveField(() => User)
author(
  @Parent() post: Post,
  @Loaders() loaders: Loaders,
) {
  return loaders.userById.load(post.authorId);
  // ↑ 전: this.prisma.user.findFirst({ where: { id: post.authorId } })  → 즉시 SQL
  //   후: load()는 SQL을 바로 실행하지 않고 key(authorId)를 "등록"만 한다.
  //       같은 틱의 load()들이 다 모이면 batch 함수가 한 번에 처리하고,
  //       각 load()가 반환한 Promise가 자기 결과로 resolve된다.
}

  @ResolveField(() => [Comment])
  comments(@Parent() post: Post, @Loaders() loaders: Loaders) {
    // 글 id를 등록 → 같은 틱의 글들을 모아 postId IN (...) 1번으로 조회
    return loaders.commentsByPostId.load(post.id);
  }
}
