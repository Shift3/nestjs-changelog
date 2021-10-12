import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectLiteral } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { ChangeInterceptor } from './change.interceptor';
import { ChangeRepository } from './change.repository';

export interface ChangeModuleOptions {
  /* If set, will limit the amount of changes stored per entity instance to
     the N most recent, where N is the number set here. If unset (by default)
     stores unlimited changes */
  maxChangesPerEntityInstance?: number;

  /* If set you will be pass the express request object and must return the
     user object for it. You would use this if you have a custom setup and
     store user at somewhere other than `req.user` */
  getUserFromRequest?: (req: any) => any;

  /* Describes how to turn req.user into a display name, the user passed in
     comes from the express req.user object, if not provided this will just
     be `user.id`` */
  userToDisplayName?: (user: any) => string;

  /* Only use these if you know what you are doing, if for some reason the
     serialization to json and from json is innadequite, you can customize it
     here */
  customSerializer?: <T extends ObjectLiteral>(columns: ColumnMetadata[], entity: T) => object;
  customDeserializer?: <T extends ObjectLiteral>(entityKlass: Function, json: object) => T;
}

@Global()
@Module({})
export class ChangeModule {
  static register(options: ChangeModuleOptions = {}): DynamicModule {
    ChangeRepository.options = options;

    const result: DynamicModule = {
      module: ChangeModule,
      imports: [
        TypeOrmModule.forFeature([ChangeRepository])
      ],
      providers: [{
        provide: APP_INTERCEPTOR,
        useValue: new ChangeInterceptor(options)
      }],
    };

    return result;
  }
}
