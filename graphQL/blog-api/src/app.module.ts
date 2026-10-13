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

import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'; //GraphQL용 Apollo 드라이버
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { UserModule } from './user/user.module.js';
import { PostModule } from './post/post.module.js';
import { CommentModule } from './comment/comment.module.js';
import { SqlCountPlugin } from './common/sql-count.plugin.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
// ↑ 새로 만든 PrismaModule import (역시 .js 확장자)
import { join } from 'node:path'; // Node.js 내장 모듈. 경로를 OS별로 안전하게 합쳐주는 join() 함수

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      // GraphQL 서버 엔진
      driver: ApolloDriver,


      // Resolver / ObjectType 등을 읽어서 schema.gql 자동 생성
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),

      // 생성되는 schema.gql을 알파벳순으로 정렬
      sortSchema: true,
    }),

    // PrismaService를 제공하는 모듈
    PrismaModule,

    // UserResolver / UserService 등이 들어있는 모듈
    UserModule,

    // PostResolver / PostService 등이 들어있는 모듈
    PostModule,

    CommentModule,
  ],

  // REST Controller
  controllers: [AppController],

  // AppModule 자체에서 사용하는 Provider
  providers: [AppService, SqlCountPlugin],
  // ↑ SqlCountPlugin: GraphQL 요청마다 실행된 SQL 개수를 콘솔에 출력 (N+1 측정용)
})
export class AppModule {}