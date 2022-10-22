import { Injectable } from '@angular/core';
import { OnlineStatusService, OnlineStatusType } from 'ngx-online-status'
import { Observable } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class ConnectionService {

  constructor(private onlineStatus: OnlineStatusService) { }

  public listen(): Observable<OnlineStatusType> {
    return this.onlineStatus.status
  }

  public getOnlineStatus(): boolean {
    return this.onlineStatus.getStatus() === OnlineStatusType.ONLINE
  }
}
