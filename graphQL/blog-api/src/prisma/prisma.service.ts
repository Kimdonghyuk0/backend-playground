// 역할: Nest 앱 전체에서 "DB에 접근하는 단 하나의 창구" 역할을 하는 서비스.
//
// 왜 PrismaClient를 그냥 new 해서 쓰지 않고 서비스로 감쌀까?
//  1) Nest의 DI(의존성 주입) 시스템에 등록하기 위해서.
//     → 다른 클래스에서 constructor(private prisma: PrismaService) 한 줄로 받아 쓸 수 있음.
//  2) Nest는 provider를 기본적으로 "싱글톤"으로 만든다.
//     → PrismaClient는 내부에 DB 커넥션 풀을 갖고 있어서,
//       여러 개 만들면 커넥션이 낭비되고 "too many connections" 에러가 날 수 있음.
//     → 서비스로 만들면 자연스럽게 앱 전체에서 딱 1개만 쓰게 됨.
//  3) Nest의 라이프사이클 훅(앱 시작/종료 시점)에 맞춰
//     DB 연결을 열고 닫을 수 있음.
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// ↑ Injectable    : "이 클래스는 Nest가 생성하고 주입해줄 수 있는 provider다"라고 표시하는 데코레이터
//   OnModuleInit  : 모듈 초기화가 끝났을 때 onModuleInit()을 호출해 달라는 인터페이스
//   OnModuleDestroy: 앱이 종료될 때 onModuleDestroy()를 호출해 달라는 인터페이스

import { PrismaClient } from '../generated/prisma/client.js';
// ↑ `npx prisma generate`가 schema.prisma를 읽어서 자동으로 만든 클라이언트.
//   - 실제 파일은 src/generated/prisma/client.ts 인데 import는 `.js`로 적는다.
//     이유: 이 프로젝트는 ESM(package.json의 "type": "module") + tsconfig "module": "nodenext" 설정이라,
//          "컴파일된 뒤의 파일 이름"(client.js)으로 경로를 적어야 Node가 찾을 수 있음.
//          (TypeScript는 .js라고 적어도 알아서 .ts 파일을 찾아서 타입 검사를 해줌)
//   - schema.prisma를 바꾸면 반드시 `npx prisma generate`를 다시 해야
//     여기 타입(prisma.user, prisma.post 등)이 갱신된다.

@Injectable()
// ↑ 이 데코레이터가 있어야 Nest가 이 클래스를 provider로 인식하고,
//   생성자 파라미터 등을 분석해서 인스턴스를 만들어 줌.
export class PrismaService
  extends PrismaClient
  // ↑ PrismaClient를 "상속"한다.
  //   → PrismaService 자체가 곧 PrismaClient가 됨.
  //   → 그래서 주입받은 쪽에서 this.prisma.user.findMany() 처럼 바로 쓸 수 있음.
  //     (상속 안 하고 내부 필드로 두면 this.prisma.client.user... 처럼 한 단계 더 들어가야 함)
  implements OnModuleInit, OnModuleDestroy
  // ↑ implements는 "이 메서드들을 반드시 구현하겠다"는 타입 약속.
  //   사실 Nest는 메서드 이름(onModuleInit)만 있으면 호출해 주지만,
  //   implements를 쓰면 오타(onModuleInt 같은)를 컴파일 단계에서 잡아준다.
{
  constructor() {
    super({
      // ↑ super(...) = 부모 클래스(PrismaClient)의 생성자 호출.
      //   PrismaClient를 만들 때 넘기는 옵션을 여기에 적는다.
      log: ['query'],
      // ↑ 실행되는 모든 SQL을 콘솔에 출력하는 옵션. ⭐ 이번 실습의 핵심 도구.
      //   콘솔에 이런 식으로 찍힘:
      //     prisma:query SELECT `main`.`User`.`id`, ... FROM `main`.`User` WHERE 1=1
      //   → 나중에 Step 4(N+1 재현)에서 이 로그 줄 수를 세서
      //     "쿼리가 몇 번 나갔는지"를 눈으로 확인한다.
      //
      //   다른 레벨도 같이 켤 수 있음:
      //     log: ['query', 'info', 'warn', 'error']
      //   실제 서비스에서는 로그가 너무 많아지니 'query'는 보통 개발 환경에서만 켠다.
    });
  }

  async onModuleInit() {
    // ↑ Nest가 이 서비스가 속한 모듈(PrismaModule)의 초기화를 마치면 자동으로 호출.
    //   호출 시점: NestFactory.create(AppModule) 실행 중, 서버가 요청을 받기 시작하기 전.
    await this.$connect();
    // ↑ DB에 미리 연결해 둔다.
    //   - 사실 Prisma는 첫 쿼리 때 알아서 연결(lazy connect)하기 때문에 없어도 동작은 함.
    //   - 그래도 명시적으로 연결하면:
    //       1) 첫 요청이 연결 시간만큼 느려지는 걸 방지
    //       2) DATABASE_URL이 틀렸거나 DB가 꺼져 있으면 "서버 시작 시점"에 바로 에러가 나서
    //          문제를 빨리 발견할 수 있음 (첫 요청 때가 아니라)
    //   - await를 붙여야 연결이 끝날 때까지 Nest가 다음 단계로 넘어가지 않음.
  }

  async onModuleDestroy() {
    // ↑ 앱이 종료될 때 Nest가 호출.
    //   ⚠️ 주의: Ctrl+C(SIGINT) 같은 "시그널"로 종료할 때 이 훅이 불리려면
    //      main.ts에서 app.enableShutdownHooks()를 호출해야 한다. (아래 Step 3 참고)
    //      안 켜면 app.close()를 직접 호출할 때만 실행된다.
    await this.$disconnect();
    // ↑ 커넥션 풀을 정리하고 DB 연결을 닫는다.
    //   SQLite는 파일 DB라 크게 문제 없지만, PostgreSQL/MySQL에서는
    //   연결을 안 닫고 프로세스를 여러 번 재시작하면 서버 쪽에 커넥션이 쌓일 수 있음.
  }
}
