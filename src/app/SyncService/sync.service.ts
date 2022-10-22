import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { OnlineStatusType } from 'ngx-online-status';
import { Observable, timeout, retry, catchError, TimeoutError, throwError, EMPTY, map, share, concat } from 'rxjs';
import { SyncToDo } from 'src/assets/models/syncToDo.model';
import { ConnectionService } from '../ConnectionService/connection.service';
import * as localforage from 'localforage';
import * as _ from 'lodash'

@Injectable({
  providedIn: 'root'
})
export class SyncService {

  public HTTP_TIMEOUT: number = 2000

  constructor(private http: HttpClient, private connection: ConnectionService) { }

  public tryPost<T>(url: string, payload: T, params?: HttpParams): Observable<T> {
    return this.http.post<T>(url, payload, { params }).pipe(timeout(this.HTTP_TIMEOUT), retry(2), catchError((err: HttpErrorResponse) => this.handleError<T>(err, url, payload, 'post', params)), share())
  }
  public tryPut<T>(url: string, payload: T, params?: HttpParams): Observable<T> {
    return this.http.put<T>(url, payload, { params }).pipe(timeout(this.HTTP_TIMEOUT), retry(2), catchError((err: HttpErrorResponse) => this.handleError(err, url, payload, 'put', params)), share())
  }
  private handleError<T>(err: HttpErrorResponse, url: string, payload: T, method: 'post' | 'put', params?: HttpParams): Observable<any> {
    if (this.offlineOrBadConnection(err)) {
      // A client-side or network error occurred. Handle it accordingly.
      console.log('handling error due to bad connection');
      this.addOrUpdateSyncTask<T>(url, payload, method, params);
      console.log('method called with', { url, payload, method, params });
      // add call to queue to retry at a later time
      return EMPTY
    } else {
      console.log('A backend error occurred.', err);
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      return throwError(err)
    }
  }
  private offlineOrBadConnection(err: HttpErrorResponse): boolean {
    return (
      err instanceof TimeoutError ||
      err.error instanceof ErrorEvent ||
      !this.connection.getOnlineStatus()  // A helper service that delegates to window.navigator.onLine
    );
  }
  private addOrUpdateSyncTask<T>(url: string, payload: T, method: 'post' | 'put', params?: HttpParams): void {
    this.getExistingSyncTasks().subscribe(tasks => {
      console.log('tasks', tasks);
      const syncTodo = new SyncToDo<T>(url, payload, params ? params.toString() : null, method);
      tasks.push(syncTodo);
      console.log('syncToDo', syncTodo);
      // localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      localforage.setItem('pendingTodos', tasks).then(x => {
        console.log('added new items to pendingTodos');
        alert('queued a new request locally :D')
      })
    })
  }

  private getExistingSyncTasks(): Observable<SyncToDo<any>[]> {
    return new Observable(observer => {
      localforage.getItem('pendingTodos').then((tasks: any) => {
        console.log('serialized tasks', tasks);
        observer.next(tasks)
        observer.complete()
      })
    })
  }
  public sync(): Observable<any> {
    return new Observable(observer => {
      this.getExistingSyncTasks().subscribe(syncTasks => {
        let requests: Observable<any>[] = []
        syncTasks.forEach((task: SyncToDo<any>) => {
          const params = task.params ? { params: new HttpParams({ fromString: task.params }) } : {}
          const response$ = this.http[task.method](task.url, task.body, params).pipe(map(_ => task), retry(2))
          requests.push(response$);
        })

        const all$ = concat(...requests).pipe(share())

        all$.subscribe(task => {
          console.log('successfully synced task:', task);
          alert('successfully synced a todo!')
          const index = syncTasks.findIndex(t => _.isEqual(t, task))
          syncTasks.splice(index, 1)
          localforage.setItem('pendingTodos', syncTasks)
        })

        observer.next(all$)
      })
    })
  }
}
