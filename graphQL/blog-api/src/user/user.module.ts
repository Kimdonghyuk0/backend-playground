import { Module } from '@nestjs/common';
import { UserResolver } from './user.resolver.js';
import { UserService } from './user.service.js';
@Module({
  providers: [UserResolver, UserService],
  // ↑ Resolver도 controller가 아니라 "provider"에 넣는다! (REST의 Controller와 다른 점)
  //   Nest GraphQL은 providers 중 @Resolver()가 붙은 클래스를 찾아서 스키마에 등록한다.
  //   UserService는 UserResolver의 생성자에 주입되기 위해 같이 등록.
  //   PrismaService는 @Global이라 여기 안 적어도 됨.
})
export class UserModule {}