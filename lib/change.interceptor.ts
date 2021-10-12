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

    let user;
    if (this.options.getUserFromRequest) {
      user = this.options.getUserFromRequest(req);
    } else {
      user = req.user;
    }

    Change.currentUserId = user?.id;
    if (user) {
      if (this.options.userToDisplayName) {
        Change.currentUserDisplay = this.options.userToDisplayName(user);
      } else {
        Change.currentUserDisplay = user.id.toString();
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
