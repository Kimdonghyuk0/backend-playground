import {Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany();
  }

  findOne(id: number) {
    return this.prisma.post.findUnique({where: {id}});
  }

   findByUserId(userId: number) {
    return this.prisma.post.findMany({where: { authorId: userId }});   
   }
}