import DataLoader from 'dataloader';
import type { Comment, Post, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export function createLoader(prisma: PrismaService) {
    return{
        //Post.author, Comment.auther에서 사용. userId로 User를 조회하는 DataLoader
        userById: new DataLoader<number,User|null>(async(ids)=>{
            const users = await prisma.user.findMany({
                where:{id:{in:[...ids]}},
            });
            const userMap = new Map(users.map((user)=>[user.id,user]));
            return ids.map((id)=>userMap.get(id)??null);
        }),
        postsByAuthorId: new DataLoader<number, Post[]>(async (authorIds) => {
        const posts = await prisma.post.findMany({
        where: { authorId: { in: [...authorIds] } },

      });

      // 1:N은 "그룹핑"이 필요하다: authorId별로 글을 묶기
      const postsByAuthor = new Map<number, Post[]>();
      for (const post of posts) {
        const list = postsByAuthor.get(post.authorId) ?? [];
        list.push(post);
        postsByAuthor.set(post.authorId, list);
      }
      // ↑ { 1 → [글1, 글2, ...글5], 2 → [글6, ...], ... }

      return authorIds.map((id) => postsByAuthor.get(id) ?? []);
      // ↑ 글이 없는 유저는 null이 아니라 빈 배열 [] (GraphQL 타입이 [Post!]! 이므로)
    }),
       commentsByPostId: new DataLoader<number, Comment[]>(async (postIds) => {
      const comments = await prisma.comment.findMany({
        where: { postId: { in: [...postIds] } },
      });

      const commentsByPost = new Map<number, Comment[]>();
      for (const comment of comments) {
        const list = commentsByPost.get(comment.postId) ?? [];
        list.push(comment);
        commentsByPost.set(comment.postId, list);
      }

      return postIds.map((id) => commentsByPost.get(id) ?? []);
    }),
    };
    
}
export type Loaders = ReturnType<typeof createLoader>;