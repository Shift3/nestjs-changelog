import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ChangeInterceptor } from './change.interceptor';
import { ChangeRepository } from './change.repository';

@Module({})
export class AuditedModule {
  static register(): DynamicModule {
    const result: DynamicModule = {
      module: AuditedModule,
      imports: [
        TypeOrmModule.forFeature([
          ChangeRepository,
        ])
      ],
      providers: [{
        provide: APP_INTERCEPTOR,
        useValue: new ChangeInterceptor()
      }],
    };

    return result;
  }
}
