import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
    constructor(private readonly prisma: PrismaService) {}
  // ↑ Nest가 PrismaService를 자동으로 주입

  async getHello() {
    return this.prisma.user.findMany();
    // ↑ 여기서 SQL이 실행됨 → 콘솔에 prisma:query 로그
  }
}
