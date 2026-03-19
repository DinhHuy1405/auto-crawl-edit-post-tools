import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PostTiktokCommand } from './commands/post-tiktok/post-tiktok.command';
import { PostReelsFacebookCommand } from './commands/post-reels-facebook/post-reels-facebook.command';
import { PostThreadsCommand } from './commands/post-threads/post-threads.command';

@Module({
  imports: [HttpModule],
  providers: [
    PostTiktokCommand,
    PostReelsFacebookCommand,
    PostThreadsCommand,
  ],
})
export class AppModule {}
