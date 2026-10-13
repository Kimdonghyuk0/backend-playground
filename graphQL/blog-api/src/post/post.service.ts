import {Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import { CreatePostInput } from './dto/create-post.input.js';
import { UpdatePostInput } from './dto/update-post.input.js';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany();
  }

  findOne(id: number) {
    return this.prisma.post.findUnique({where: {id}});
  }

   findByUserId(userId: number) {
    return this.prisma.post.findMany({where: { authorId: userId }});   
   }

  async create(input: CreatePostInput) {
    await this.ensureUserExists(input.authorId);
    // ↑ 존재하지 않는 작성자로 글을 만들려고 하면 먼저 막는다.
    //   이게 없으면? → DB의 외래키(FK) 제약에 걸려서
    //   "Foreign key constraint violated" 라는 Prisma 내부 에러가 그대로 클라이언트에 노출된다.
    //   (실제로 테스트해보면 이 메시지가 나옴. 사용자 친화적이지 않음)

    return this.prisma.post.create({ data: input });
    // ↑ INSERT INTO Post (...) VALUES (...) 실행 후, 생성된 행 전체를 반환.
    //   input 객체의 모양이 Prisma create의 data 모양과 같아서 그대로 넘길 수 있다.
    //   (title, content, published?, authorId)
  }

  async update(id: number, input: UpdatePostInput) {
    await this.ensurePostExists(id);
    // ↑ 없는 글을 수정하려 하면 404 에러.
    //   이게 없으면? → Prisma update가 P2025 에러("Record to update not found")를 던진다.

    return this.prisma.post.update({
      where: { id },
      data: input,
      // ↑ input에 들어있는 필드만 UPDATE된다.
      //   { title: "새 제목" } 만 보내면 → UPDATE Post SET title = ? WHERE id = ?
      //   (안 보낸 필드는 undefined → Prisma가
    });
  }

  async remove(id: number) {
    await this.ensurePostExists(id);

    await this.prisma.comment.deleteMany({ where: { postId: id } });
    // ↑ ⭐ 댓글을 먼저 지워야 한다!
    //   Comment가 Post를 참조(FK)하고 있어서, 댓글이 달린 글을 바로 지우면
    //   외래키 제약 위반 에러가 난다. (시드 데개씩 있음)
    //   💡 대안: schema.prisma에서 relation에 onDelete: Cascade를 주면
    //          글을 지울 때 DB가 댓글도 자동으로 지워준다.

    await this.prisma.post.delete({ where: { id } });
    return true;
    // ↑ Mutation 반환 타입이 Boolean이라 true

  }
    private async ensurePostExists(id: number) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post(id: ${id})를 찾을 수 없습니다.`);
      // ↑ throw하면 이후 코드는 실행되지 않고, Nest가 잡아서 GraphQL 에러로 바꿔준다.
    }
  }

  private async ensureUserExists(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User(id: ${id})를 찾을 수 없습니다.`);
    }
  }

}




