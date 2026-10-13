
// ─────────────────────────────────────────────────────────────────────────────
// UserService
// ─────────────────────────────────────────────────────────────────────────────
// Resolver는 "GraphQL 요청을 받는 입구"이고,
// Service는 "실제 일을 하는 곳"(DB 조회, 비즈니스 로직).
// 이렇게 나누면:
//   - Resolver는 얇게 유지 (인자 받고 → service 호출 → 반환)
//   - 같은 로직을 다른 곳(다른 resolver, REST controller 등)에서도 재사용 가능
//   - 테스트할 때 service만 따로 테스트 가능
// ─────────────────────────────────────────────────────────────────────────────
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserInput } from './dto/create-user.input.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}
  // ↑ PrismaModule이 @Global이라 UserModule에서 import 안 해도 주입된다.

  findAll() {
    return this.prisma.user.findMany();
     // ↑ SELECT * FROM User
    //   async/await를 안 써도 되는 이유: Prisma는 Promise를 반환하고,
    //   GraphQL(Apollo)이 Promise를 알아서 기다려(resolve)준다.
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
    // ↑ SELECT * FROM User WHERE id = ? LIMIT 1
    //   findUnique: @id 나 @unique 필드로만 조회 가능. 없으면 null 반환 (에러 아님).
    //   { where: { id } } 는 { where: { id: id } } 의 축약 문법.
  }

  async create(input: CreateUserInput) {
    try {
      return await this.prisma.user.create({ data: input });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          `이미 사용 중인 이메일입니다: ${input.email}`,
        );
      }
      throw e;
    }
  }
}
