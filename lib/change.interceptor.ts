import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { catchError, throwError, tap } from "rxjs";
import { Change } from "./change.entity";


@Injectable()
export class ChangeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {

    const req = context.switchToHttp().getRequest();

    Change.currentUserId = req?.user?.id;

    return next
      .handle()
      .pipe(
        tap(() => { Change.currentUserId = null }),
        catchError(err => {
          Change.currentUserId = null;
          return throwError(() => new Error(err));
        })
      );
  }
}
