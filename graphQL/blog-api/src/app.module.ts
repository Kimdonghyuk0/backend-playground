// ─────────────────────────────────────────────────────────────────────────────
// AppModule (루트 모듈)
// ─────────────────────────────────────────────────────────────────────────────
// main.ts에서 NestFactory.create(AppModule)로 시작하는 "앱의 뿌리" 모듈.
// Nest는 여기서부터 imports를 따라 내려가며 모든 모듈/provider를 찾아 등록한다.
//   AppModule
//    ├── PrismaModule (Global)   ← 이번에 추가
//    ├── GraphQLModule           ← 다음 단계(가이드 Step 2)에서 추가
//    ├── UserModule              ← 이후 추가
//    └── PostModule ...
// ─────────────────────────────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
// ↑ 새로 만든 PrismaModule import (역시 .js 확장자)

@Module({
  imports: [PrismaModule],
  // ↑ 여기에 넣는 순간 PrismaModule이 앱에 등록됨.
  //   @Global() 모듈이므로 이후 만드는 모든 모듈에서 PrismaService를 바로 주입 가능.
  controllers: [AppController],
  // ↑ nest new가 만들어 준 예제 컨트롤러 (GET / → "Hello World!")
  //   GraphQL만 쓸 거라 나중에 지워도 됨.
  providers: [AppService],
})
export class AppModule {}