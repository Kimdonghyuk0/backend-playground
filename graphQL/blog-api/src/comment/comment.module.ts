import { Module } from '@nestjs/common';
import { CommentResolver } from './comment.resolver.js';

@Module({
  providers: [CommentResolver],
})
export class CommentModule {}
