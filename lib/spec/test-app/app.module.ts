import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { addChangeDetectionToConnection } from "../..";
import { ChangeModule } from "../../change.module";
import { RelatedThingy } from "./related.entity";
import { Tracked } from "./tracked.entity";
import { UnTracked } from "./untracked.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot(addChangeDetectionToConnection({
      type: 'postgres',
      username: process.env.DB_USER || undefined,
      host: 'localhost',
      database: 'nestjs-changelog-tests',
      entities: [Tracked, UnTracked, RelatedThingy],
      synchronize: true,
    })),
    ChangeModule.register({
      userToDisplayName: (user) => `${user.first_name} ${user.last_name}`
    }),
  ]
})
export class AppModule {};