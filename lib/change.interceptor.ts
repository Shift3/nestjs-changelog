import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import { catchError, tap, throwError } from "rxjs";
import { Change } from "./change.entity";
import { ChangeModuleOptions } from "./change.module";

@Injectable()
export class ChangeInterceptor implements NestInterceptor {
  options: ChangeModuleOptions;
  constructor(options: ChangeModuleOptions) {
    this.options = options;
  }

  private reset() {
    Change.currentUserId = null;
    Change.currentUserDisplay = null;
  }

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();

    Change.currentUserId = req?.user?.id;
    if (req?.user) {
      if (this.options.userToDisplayName) {
        Change.currentUserDisplay = this.options.userToDisplayName(req.user);
      } else {
        Change.currentUserDisplay = req.user.id.toString();
      }
    }

    return next
      .handle()
      .pipe(
        tap(() => { this.reset(); }),
        catchError(err => {
          this.reset();
          return throwError(() => new Error(err));
        })
      );
  }
}
