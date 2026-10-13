import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'node:path';

import { UserModule } from './user/user.module.js';
import { PostModule } from './post/post.module.js';
import { CommentModule } from './comment/comment.module.js';

import { SqlCountPlugin } from './common/sql-count.plugin.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';

import { createLoader } from './loader/loaders.js';

@Module({
  imports: [
    PrismaModule,

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,

      inject: [PrismaService],

      useFactory: (prisma: PrismaService) => ({
        // Code First 방식으로 GraphQL Schema 생성
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),

        sortSchema: true,

        // GraphQL 요청마다 context 생성
        context: () => ({
          loaders: createLoader(prisma),
        }),
      }),
    }),

    UserModule,
    PostModule,
    CommentModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    SqlCountPlugin,
  ],
})
export class AppModule {}