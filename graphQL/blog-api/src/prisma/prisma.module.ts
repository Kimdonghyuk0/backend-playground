
// ─────────────────────────────────────────────────────────────────────────────
// PrismaModule
// ─────────────────────────────────────────────────────────────────────────────
// 역할: PrismaService를 "앱 전체에 공급"하는 모듈.
//
// Nest의 기본 규칙:
//   어떤 모듈의 provider는 기본적으로 "그 모듈 안에서만" 쓸 수 있다.
//   다른 모듈이 쓰려면
//     1) 제공하는 모듈이 exports에 넣고
//     2) 사용하는 모듈이 imports에 그 모듈을 넣어야 한다.
//
//   예) UserModule, PostModule, CommentModule이 전부 PrismaService를 쓴다면
//       → 세 모듈 모두 imports: [PrismaModule]을 적어야 함 (귀찮음)
//
//   @Global()을 붙이면 AppModule에서 한 번만 import하면
//   모든 모듈이 imports 없이 PrismaService를 주입받을 수 있다.
//   → DB 클라이언트, 설정(Config)처럼 "거의 모든 곳에서 쓰는 것"에만 쓰는 게 관례.
//     (아무 모듈에나 남발하면 의존 관계가 안 보여서 구조 파악이 어려워짐)
// ─────────────────────────────────────────────────────────────────────────────

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
// ↑ 같은 폴더의 파일이라도 ESM이므로 `.js` 확장자를 꼭 붙인다.
//   (빠뜨리면 실행 시 ERR_MODULE_NOT_FOUND 에러)

@Global()
// ↑ 이 모듈을 "전역 모듈"로 만든다.
//   주의: @Global()이어도 "어딘가에서 한 번은" import 되어야 등록된다.
//        → 그래서 Step 3에서 AppModule의 imports에 넣는 것.
@Module({
  providers: [PrismaService],
  // ↑ 이 모듈 안에서 Nest가 생성하고 관리할 클래스 목록.
  //   여기 넣으면 Nest가 PrismaService 인스턴스를 1개(싱글톤) 만들어 둔다.
  exports: [PrismaService],
  // ↑ 이 모듈 "밖"에서도 PrismaService를 쓸 수 있게 공개.
  //   ⚠️ providers에만 넣고 exports를 빠뜨리면, 다른 모듈에서 주입받을 때
  //      "Nest can't resolve dependencies of the XxxService (?)..." 에러가 난다.
  //      (@Global이어도 exports는 필요함)
})
export class PrismaModule {}
// ↑ 모듈 클래스 자체는 비어 있는 게 정상. 설정은 전부 데코레이터에 들어있음.
