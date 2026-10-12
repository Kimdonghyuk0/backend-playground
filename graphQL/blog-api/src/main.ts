import 'dotenv/config';
// ↑ ⭐ 반드시 "맨 첫 줄"에 있어야 함.
//   .env 파일을 읽어서 process.env.DATABASE_URL 등을 채워준다.
//   ESM에서는 import가 위에서부터 순서대로 실행되므로,
//   이게 AppModule(→ PrismaService)보다 먼저 실행되어야
//   Prisma가 DATABASE_URL을 찾을 수 있다.
//   (없으면: "Environment variable not found: DATABASE_URL" 에러)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ↑ AppModule부터 시작해서 모든 모듈/provider를 생성하고 연결(DI)한다.
  //   이 과정에서 PrismaService.onModuleInit() → $connect() 가 실행됨.

  app.enableShutdownHooks();
  // ↑ Ctrl+C(SIGINT), kill(SIGTERM) 같은 종료 시그널을 받으면
  //   onModuleDestroy() 같은 종료 훅을 실행하도록 켠다.
  //   → PrismaService.onModuleDestroy() → $disconnect() 가 제대로 호출됨.

  await app.listen(process.env.PORT ?? 3000);
  // ↑ HTTP 서버 시작. PORT 환경변수가 없으면 3000번 포트.
}
await bootstrap();
// ↑ ESM이라 파일 최상단에서 바로 await를 쓸 수 있다 (top-level await).