import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Loaders as LoadersType } from './loaders.js';
// ↑ 아래 const Loaders와 이름이 겹치면 "Import declaration conflicts" 에러가 나서 별칭으로 가져온다.

export type Loaders = LoadersType;
// ↑ 같은 파일 안에서 선언한 type Loaders와 const Loaders는 공존할 수 있다. (값/타입 이름 공간이 따로)
//   → resolver에서 import { Loaders } 한 줄로 데코레이터(값)와 타입을 둘 다 쓸 수 있다.

export const Loaders = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Loaders => {
    const gqlCtx = GqlExecutionContext.create(ctx);
    // ↑ GraphQL resolver 인자는 (parent, args, context, info) 순서라 REST용 ctx 그대로는 못 쓴다.
    return gqlCtx.getContext<{ loaders: Loaders }>().loaders;
    // ↑ app.module의 context: () => ({ loaders: ... })에서 만든 객체의 loaders
  },
);
