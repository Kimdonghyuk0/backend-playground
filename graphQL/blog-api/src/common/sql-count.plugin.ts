// ─────────────────────────────────────────────────────────────────────────────
// SqlCountPlugin
// ─────────────────────────────────────────────────────────────────────────────
// GraphQL 요청 1개마다 "SQL이 몇 개 실행됐는지"를 콘솔에 출력하는 Apollo 플러그인.
//   🔢 SQL 51개  ←  { posts { title author { name } } }
//
// 동작 원리:
//   1) 요청이 시작될 때 PrismaService.queryCount 값을 기억해 두고 (before)
//   2) 응답을 보내기 직전에 다시 읽어서 (after)
//   3) after - before = 이번 요청에서 실행된 SQL 개수
//
// ⚠️ 학습용 도구: 요청이 동시에 여러 개 들어오면 개수가 섞일 수 있다.
//    GraphiQL에서 쿼리를 하나씩 실행하는 실습 환경에서는 정확하다.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { PrismaService } from '../prisma/prisma.service.js';

@Plugin()
// ↑ Nest가 이 클래스를 Apollo Server 플러그인으로 등록하게 해주는 데코레이터.
//   어떤 모듈의 providers에 넣어두면 자동으로 GraphQL 서버에 연결된다.
export class SqlCountPlugin implements ApolloServerPlugin<object> {
  constructor(private readonly prisma: PrismaService) {}

  async requestDidStart({
    request,
  }: GraphQLRequestContext<object>): Promise<GraphQLRequestListener<object> | void> {
    // ↑ GraphQL 요청이 들어올 때마다 Apollo가 호출하는 훅.
    if (request.operationName === 'IntrospectionQuery') return;
    // ↑ GraphiQL이 스키마를 읽으려고 자동으로 보내는 요청은 집계에서 제외.

    const prisma = this.prisma;
    const before = prisma.queryCount;
    const query = (request.query ?? '').replace(/\s+/g, ' ').trim();
    // ↑ 여러 줄 쿼리를 한 줄로 압축해서 로그에 보기 좋게 출력.

    return {
      async willSendResponse() {
        // ↑ 모든 resolver 실행이 끝나고 응답을 보내기 직전에 호출되는 훅.
        await new Promise((resolve) => setTimeout(resolve, 50));
        // ↑ Prisma의 query 이벤트는 SQL이 끝난 뒤 "조금 늦게" 도착할 수 있다.
        //   바로 세면 일부가 다음 요청 개수에 섞이므로, 잠깐 기다렸다가 센다. (학습용이라 50ms 지연 허용)
        const count = prisma.queryCount - before;
        console.log(`\n🔢 SQL ${count}개  ←  ${query}\n`);
      },
    };
  }
}
